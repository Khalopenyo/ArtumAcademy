import { VerifyForm } from './VerifyForm';

export const metadata = {
  title: 'Проверка сертификата',
  description: 'Проверьте подлинность сертификата Artum Academy по его номеру.',
};

export default function VerifyIndexPage() {
  return <VerifyForm />;
}
