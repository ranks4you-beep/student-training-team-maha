import { handle } from '../../lib/training-server';
export const dynamic = 'force-dynamic';
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
// Cross-origin preflights from the GitHub Pages frontend must reach the handler.
export const OPTIONS = handle;
