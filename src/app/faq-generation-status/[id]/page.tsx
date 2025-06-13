import FAQDetail from './FAQDetail';

export default async function FAQPairDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  return <FAQDetail id={resolvedParams.id} />;
} 