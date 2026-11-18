import { ArcadeStage } from '@/components/ArcadeStage';
import { loadHydratedState } from '@/lib/state-loader';

export const dynamic = 'force-dynamic';

const HomePage = async () => {
  const initialState = await loadHydratedState();
  return <ArcadeStage initialState={initialState} />;
};

export default HomePage;
