import { NextResponse } from 'next/server';
import { normalizeError } from '@/lib/errors';
import { loadHydratedState } from '@/lib/state-loader';

export const GET = async (): Promise<NextResponse> => {
  try {
    const state = await loadHydratedState();
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json(
      { error: normalizeError(err, 'Failed to load state.') },
      { status: 500 }
    );
  }
};
