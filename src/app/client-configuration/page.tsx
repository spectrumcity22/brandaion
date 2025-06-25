"use client";

/// <reference types="next-auth/react" />
/// <reference types="@/lib/supabase" />
/// <reference types="react-hot-toast" />

// Please install the necessary type declarations for the imported modules:
// npm install --save-dev @types/next-auth @types/react-hot-toast

// Please add the following to your tsconfig.json file:
// {
//   "compilerOptions": {
//     "types": ["next-auth", "react-hot-toast"]
//   }
// }

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

interface Brand {
  id: string;
  name: string;
  jsonld_object: string;
}

interface Product {
  id: string;
  product_name: string;
  schema_json: string;
}

interface Persona {
  id: string;
  persona_name: string;
  persona_jsonld: string;
}

interface Market {
  id: string;
  name: string;
}

interface Audience {
  id: string;
  audience_name: string;
  json_audience: string;
}

const ClientConfiguration: React.FC = () => {
  const session = useSession();
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("client_configuration")
        .upsert({
          auth_user_id: user.id,
          brand_id: selectedBrand,
          product_id: selectedProduct,
          persona_id: selectedPersona,
          market_id: selectedMarket,
          audience_id: selectedAudience,
          brand_name: selectedBrand ? brands.find(b => b.id === selectedBrand)?.name : null,
          product_name: selectedProduct ? products.find(p => p.id === selectedProduct)?.product_name : null,
          persona_name: selectedPersona ? personas.find(p => p.id === selectedPersona)?.persona_name : null,
          market_name: selectedMarket ? markets.find(m => m.id === selectedMarket)?.name : null,
          audience_name: selectedAudience ? audiences.find(a => a.id === selectedAudience)?.audience_name : null,
          brand_jsonld_object: selectedBrand ? brands.find(b => b.id === selectedBrand)?.jsonld_object : null,
          schema_json: selectedProduct ? products.find(p => p.id === selectedProduct)?.schema_json : null,
          persona_jsonld: selectedPersona ? personas.find(p => p.id === selectedPersona)?.persona_jsonld : null,
          audience_json: selectedAudience ? audiences.find(a => a.id === selectedAudience)?.json_audience : null,
          organisation_jsonld_object: null // This will be populated by the merge function from client_organisation
        });

      if (error) throw error;

      // Call the merge function after successful save
      const webhookResponse = await fetch("https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/merge_schedule_and_configuration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ auth_user_id: user.id }),
      });

      const webhookData = await webhookResponse.json();

      if (!webhookResponse.ok) {
        console.error("Webhook error:", webhookData);
        toast.error(`Failed to trigger merge function: ${webhookData.error || 'Unknown error'}`);
      } else {
        if (webhookData.processed_count === 0) {
          toast.error("Configuration saved but no schedule rows found to process. Please check your payment status.");
        } else {
          toast.success(`Configuration saved and ${webhookData.processed_count} schedule rows processed successfully!`);
        }
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Failed to save configuration");
    }
  };

  return (
    <div>
      {/* Form submission code */}
    </div>
  );
};

export default ClientConfiguration; 