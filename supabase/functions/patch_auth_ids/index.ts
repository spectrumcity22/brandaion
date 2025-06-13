// @deno-types="https://deno.land/x/servest@v1.3.1/types/react/index.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Invoice {
  id: string;
  user_email: string;
}

interface EndUser {
  auth_user_id: string;
}

interface ErrorRecord {
  invoice_id: string;
  step: "lookup_end_user" | "set_auth_user_id";
  error: string;
}

interface ResponseData {
  patched: number;
  skipped: number;
  errors: ErrorRecord[];
}

serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // 1. Fetch invoices with missing auth_user_id
    const { data: invoices, error: fetchError } = await supabase
      .from("invoices")
      .select("id, user_email")
      .is("auth_user_id", null);

    if (fetchError) {
      console.error("Failed to fetch invoices:", fetchError);
      return new Response(
        JSON.stringify({
          error: fetchError.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result: ResponseData = {
      patched: 0,
      skipped: 0,
      errors: [],
    };

    // 2. Process each invoice
    for (const invoice of (invoices as Invoice[]) ?? []) {
      try {
        // Look up end_user by email
        const { data: user, error: userError } = await supabase
          .from("end_users")
          .select("auth_user_id")
          .eq("email", invoice.user_email)
          .single();

        if (user?.auth_user_id && !userError) {
          // Update invoice with auth_user_id
          const { error: updateError } = await supabase
            .from("invoices")
            .update({ auth_user_id: user.auth_user_id })
            .eq("id", invoice.id);

          if (!updateError) {
            result.patched++;
            console.log(
              `✅ Patched invoice ${invoice.id} with user ${user.auth_user_id}`
            );
          } else {
            result.errors.push({
              invoice_id: invoice.id,
              step: "set_auth_user_id",
              error: updateError.message,
            });
          }
        } else {
          result.skipped++;
          if (userError || !user) {
            result.errors.push({
              invoice_id: invoice.id,
              step: "lookup_end_user",
              error:
                userError?.message || "auth_user_id missing on matched end_user",
            });
          }
        }
      } catch (error) {
        result.errors.push({
          invoice_id: invoice.id,
          step: "lookup_end_user",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Return summary
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}); 