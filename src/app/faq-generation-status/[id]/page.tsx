import FAQDetail from './FAQDetail';

interface PageProps {
  params: {
    id: string;
  };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function FAQPairDetail({ params }: PageProps) {
  return <FAQDetail id={params.id} />;
} 