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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const packageRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);
  const monitoringRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
    });

    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current && !profileRef.current.contains(event.target as Node) &&
        packageRef.current && !packageRef.current.contains(event.target as Node) &&
        configRef.current && !configRef.current.contains(event.target as Node) &&
        faqRef.current && !faqRef.current.contains(event.target as Node) &&
        monitoringRef.current && !monitoringRef.current.contains(event.target as Node) &&
        adminRef.current && !adminRef.current.contains(event.target as Node)
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
          
          <div className="flex items-center space-x-6 text-sm font-medium">
            {!loggedIn ? (
              <>
                <Link href="/signup" className="hover:text-green-400">Sign Up</Link>
                <Link href="/login" className="hover:text-green-400">Login</Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="hover:text-green-400">Dashboard</Link>
                
                {/* Package Dropdown */}
                <div ref={packageRef} className="relative">
                  <button
                    className="hover:text-green-400"
                    onClick={() => setOpenDropdown(openDropdown === 'package' ? null : 'package')}
                  >
                    Package ▾
                  </button>
                  {openDropdown === 'package' && (
                    <div className="absolute left-0 mt-2 w-48 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/packages" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Select Package</Link>
                      <Link href="/invoice_confirmation" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Invoices</Link>
                      <Link href="/schedule" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Schedule</Link>
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
                      <Link href="/client_brands_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Brand Management</Link>
                      <Link href="/client_products" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Product Management</Link>
                      <Link href="/client_product_persona_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Persona Management</Link>
                    </div>
                  )}
                </div>
                
                {/* FAQs Dropdown */}
                <div ref={faqRef} className="relative">
                  <button
                    className="hover:text-green-400"
                    onClick={() => setOpenDropdown(openDropdown === 'faq' ? null : 'faq')}
                  >
                    FAQs ▾
                  </button>
                  {openDropdown === 'faq' && (
                    <div className="absolute left-0 mt-2 w-48 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/client_configuration_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Configure AI</Link>
                      <Link href="/review-questions" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Review Questions</Link>
                      <Link href="/review-answers" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Review Answers</Link>
                      <Link href="/faq-pairs" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>FAQ Pairs</Link>
                    </div>
                  )}
                </div>
                
                {/* Monitoring Dropdown */}
                <div ref={monitoringRef} className="relative">
                  <button
                    className="hover:text-green-400"
                    onClick={() => setOpenDropdown(openDropdown === 'monitoring' ? null : 'monitoring')}
                  >
                    Monitoring ▾
                  </button>
                  {openDropdown === 'monitoring' && (
                    <div className="absolute left-0 mt-2 w-56 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/faq-performance" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>FAQ Performance Setup</Link>
                      <Link href="/monthly-report" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Monthly Performance Report</Link>
                    </div>
                  )}
                </div>
                
                {/* Admin Dropdown */}
                <div ref={adminRef} className="relative">
                  <button
                    className="hover:text-green-400"
                    onClick={() => setOpenDropdown(openDropdown === 'admin' ? null : 'admin')}
                  >
                    Admin ▾
                  </button>
                  {openDropdown === 'admin' && (
                    <div className="absolute left-0 mt-2 w-56 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/faq-batches" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>FAQ Batches</Link>
                      <Link href="/llm-discovery-construction" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>LLM Discovery Construction</Link>
                      <Link href="/llm-discovery" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>LLM Discovery Directory</Link>
                    </div>
                  )}
                </div>
                
                {/* Profile Icon in Top Right */}
                <div ref={profileRef} className="relative">
                  <button
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                    onClick={() => setOpenDropdown(openDropdown === 'profile' ? null : 'profile')}
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {openDropdown === 'profile' && (
                    <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded shadow-lg z-50">
                      <Link href="/end_user_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>User Profile</Link>
                      <Link href="/organisation_form" className="block px-4 py-2 hover:bg-gray-200" onClick={() => setOpenDropdown(null)}>Organisation</Link>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button 
                        onClick={() => {
                          handleLogout();
                          setOpenDropdown(null);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-gray-200 text-red-600"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </nav>
        <main className="pt-24 px-4">{children}</main>
      </body>
    </html>
  );
}
   
