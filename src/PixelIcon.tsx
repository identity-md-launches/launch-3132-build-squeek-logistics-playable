import type { Resource } from './game';
export function PixelIcon({ name, size = 28 }: { name: Resource | 'credits' | 'hamster' | 'crate'; size?: number }) {
  const art = {
    wood: <><path fill="#6b432b" d="M3 13 21 4l9 6v11l-18 9-9-6z"/><path fill="#b67e45" d="m3 13 9 6 18-9-9-6z"/><path fill="#d9a760" d="M4 14v9l8 5v-9z"/><path fill="#6b432b" d="m10 10 3 2 13-6-3-1zm5 7 3-1v11l-3 1z"/><path fill="#f0c581" d="m6 17 4 2v5l-4-2z"/></>,
    stone: <><path fill="#53616b" d="m3 19 6-11 13-3 8 12-4 11H9z"/><path fill="#a8b2b6" d="m4 18 5-10 13-2-4 13z"/><path fill="#7d8b96" d="m18 19 4-13 7 11-4 9z"/><path fill="#c4cac4" d="m9 10 10-2-4 4H8z"/></>,
    metal: <><path fill="#405c65" d="m2 15 8-6 20 1v14l-8 5L2 27z"/><path fill="#a9c6ca" d="m2 15 8-6 20 1-8 7z"/><path fill="#719ba7" d="m2 17 20 2v10L2 27z"/><path fill="#ddeded" d="m6 13 5-3 15 1-5 3z"/><path fill="#405c65" d="M8 20h2v6H8zm9 1h2v6h-2z"/></>,
    planks: <><path fill="#805333" d="m2 13 20-7 8 5v5l-19 8-9-5zm0 9 19-7 9 6v4l-19 7-9-5z"/><path fill="#e0b675" d="m2 13 20-7 8 5-19 8zm0 9 19-7 9 6-19 7z"/><path stroke="#ad7944" strokeWidth="2" d="m7 13 15-5M8 23l13-5"/></>,
    tools: <><path fill="#68472f" d="m6 29-4-4L22 5l4 4z"/><path fill="#a0b8b8" d="M17 3h13v7l-6 6-8-8z"/><path fill="#dee7d9" d="M19 4h10v3H19z"/><path fill="#4a6670" d="m4 4 4-2 5 7-3 3 17 15-4 4L7 14l-5-5z"/></>,
    credits: <><path fill="#9c6b24" d="M7 3h18v3h3v21h-3v3H7v-3H4V6h3z"/><path fill="#e1ac45" d="M8 5h15v3h3v16h-3v3H8v-3H6V8h2z"/><path fill="#ffe19a" d="M9 7h13v3H9zM8 10h3v13H8z"/><path fill="#8e6329" d="M15 11h6v3h-6v6h6v3h-9V11z"/></>,
    hamster: <><path fill="#b57546" d="M5 4h8v10H5zm15 0h8v10h-8zM4 15h24v14H4zM9 10h14v21H9z"/><path fill="#f3b7a1" d="M7 6h4v6H7zm15 0h4v6h-4z"/><path fill="#f8e5c3" d="M6 18h20v9H6zm5-5h11v17H11z"/><path fill="#283e32" d="M9 16h3v4H9zm12 0h3v4h-3zm-6 7h5v3h-5z"/><path fill="#fff7e6" d="M15 26h4v5h-4z"/></>,
    crate: <><path fill="#69492d" d="m3 10 16-7 11 8v16l-17 5-10-7z"/><path fill="#c99353" d="m4 11 15-6 10 6-16 7z"/><path fill="#b57c40" d="M5 14v10l7 5V19zm10 5 13-5v11l-13 5z"/><path fill="#e1b475" d="m7 11 5-2 10 6-5 2zM9 17h2v9H9zm9 2h3v8h-3z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} shapeRendering="crispEdges" className={`pixel-icon ${name}`}>{art[name]}</svg>;
}
