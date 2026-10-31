import { createContext } from "react";

/**
 * The footer of a whiteboard card. A card's content can portal a compact control into it (a
 * graph's 2D/3D switch) instead of adding chrome over the content. Null outside a board card.
 */
export const CardFooterSlotContext = createContext<HTMLElement | null>(null);
