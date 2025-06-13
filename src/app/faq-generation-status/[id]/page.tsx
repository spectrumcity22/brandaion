import FAQDetail from './FAQDetail';

type Props = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function FAQPairDetail({ params }: Props) {
  return <FAQDetail id={params.id} />;
} 