import FAQDetail from './FAQDetail';

export default function FAQPairDetail({
  params,
}: {
  params: { id: string }
}) {
  return <FAQDetail id={params.id} />;
} 