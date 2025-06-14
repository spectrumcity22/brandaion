import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/onboarding_router', label: 'Dashboard' },
  { href: '/review-questions', label: 'Review Questions' },
  { href: '/end_user_form', label: 'Profile' },
  { href: '/organisation_form', label: 'Organization' },
  { href: '/select_package', label: 'Packages' },
  { href: '/invoice_confirmation', label: 'Invoice' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/client_products', label: 'Products' },
  { href: '/client_product_persona_form', label: 'Persona Form' },
  { href: '/client_configuration_form', label: 'Configure AI' },
  { href: '/faq-generation-status', label: 'FAQ Generation Status' },
  // Add more routes as needed
];

export default function AllLinksPage() {
  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">All Active Pages</h1>
      <ul className="space-y-3">
        {links.map(link => (
          <li key={link.href}>
            <Link href={link.href} className="text-blue-600 hover:underline text-lg">
              {link.label} <span className="text-gray-400 text-sm">({link.href})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
} 