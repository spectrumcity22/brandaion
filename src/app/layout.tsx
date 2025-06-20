'use client';
import "./globals.css";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [batchesOpen, setBatchesOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const batchesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
    });

    function handleClickOutside(event: MouseEvent) {
      if (
        accountRef.current && !accountRef.current.contains(event.target as Node) &&
        configRef.current && !configRef.current.contains(event.target as Node) &&
        batchesRef.current && !batchesRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      listener?.subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
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
                {/* Account Dropdown */}
                <div ref={accountRef} className="relative">
                  <button
                    className="hover:text-green-400"
                    onClick={() => setOpenDropdown(openDropdown === 'account' ? null : 'account')}
                  >
                    Account ▾
                  </button>
                  {openDropdown === 'account' && (
                    <div className="absolute left-0 mt-2 w-40 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/end_user_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Profile</Link>
                      <Link href="/organisation_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Organization</Link>
                      <Link href="/invoice_confirmation" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Invoice</Link>
                    </div>
                  )}
                </div>
                {/* Configuration Dropdown */}
                <div ref={configRef} className="relative">
                  <button
                    className="hover:text-green-400"
                    onClick={() => setOpenDropdown(openDropdown === 'config' ? null : 'config')}
                  >
                    Configuration ▾
                  </button>
                  {openDropdown === 'config' && (
                    <div className="absolute left-0 mt-2 w-48 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/client_product_persona_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Persona Form</Link>
                      <Link href="/client_configuration_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Configure AI</Link>
                      <Link href="/client_products" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Products</Link>
                    </div>
                  )}
                </div>
                {/* Batches Dropdown */}
                <div ref={batchesRef} className="relative">
                  <button
                    className="hover:text-green-400"
                    onClick={() => setOpenDropdown(openDropdown === 'batches' ? null : 'batches')}
                  >
                    Batches ▾
                  </button>
                  {openDropdown === 'batches' && (
                    <div className="absolute left-0 mt-2 w-56 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/schedule" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Schedule</Link>
                      <Link href="/review-questions" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Review Questions</Link>
                      <Link href="/review-answers" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Review Answers</Link>
                      <Link href="/faq-batches" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>FAQ Batches</Link>
                    </div>
                  )}
                </div>
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
   
