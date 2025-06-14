'use client';
import "./globals.css";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <html lang="en">
      <body className="min-h-screen font-sans bg-white text-black">
        <nav className="fixed top-0 left-0 w-full bg-black text-white flex items-center justify-between px-6 py-4 shadow-md z-50">
          <Link href="/" className="text-xl font-bold hover:text-green-400">
            BrandAION
          </Link>
          <div className="flex space-x-6 text-sm font-medium">
            {!loggedIn ? (
              <>
                <Link href="/signup" className="hover:text-green-400">Sign Up</Link>
                <Link href="/login" className="hover:text-green-400">Login</Link>
              </>
            ) : (
              <>
                <Link href="/onboarding_router" className="hover:text-green-400">Dashboard</Link>
                <Link href="/review-questions" className="hover:text-green-400">Review Questions</Link>
                <Link href="/end_user_form" className="hover:text-green-400">Profile</Link>
                <Link href="/organisation_form" className="hover:text-green-400">Organization</Link>
                <Link href="/select_package" className="hover:text-green-400">Packages</Link>
                <Link href="/invoice_confirmation" className="hover:text-green-400">Invoice</Link>
                <Link href="/schedule" className="hover:text-green-400">Schedule</Link>
                <Link href="/client_products" className="hover:text-green-400">Products</Link>
                <Link href="/client_product_persona_form" className="hover:text-green-400">Persona Form</Link>
                <Link href="/client_configuration_form" className="hover:text-green-400">Configure AI</Link>
                <button onClick={handleLogout} className="hover:text-red-400">Log Out</button>
              </>
            )}
          </div>
        </nav>
        <main className="pt-24 px-4">{children}</main>
      </body>
    </html>
  );
}
   
