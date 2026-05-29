import { useEffect, useState } from 'react';

// Tiny wrapper that delays mounting children until `open` first becomes
// true, then keeps them mounted for the rest of the session. Pairs with
// React.lazy() chunks so:
//   • The chunk isn't fetched until the user actually opens the surface
//   • After first open, the chunk is cached → instant reopen
//   • The child's own AnimatePresence exit animation plays on close
//     (because the child stays mounted across the open→closed transition)

export default function LazyWhenOpened({ open, children }) {
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => { if (open && !hasOpened) setHasOpened(true); }, [open, hasOpened]);
  if (!hasOpened) return null;
  return children;
}
