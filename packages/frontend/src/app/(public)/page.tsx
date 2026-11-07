import { HomeContent } from '../components/home/HomeContent';
import { getI18n } from '../i18n/server';

export default async function HomePage() {
  const { dict } = await getI18n();
  return <HomeContent dict={dict.home} />;
}
