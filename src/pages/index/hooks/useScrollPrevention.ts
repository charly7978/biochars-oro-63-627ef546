
import { useEffect } from 'react';

export const useScrollPrevention = () => {
  useEffect(() => {
    console.log("DEBUG: Setting up scroll prevention");
    
    const preventScroll = (e: Event) => e.preventDefault();
    
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });
    
    console.log("DEBUG: Scroll prevention listeners attached");
    
    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
      console.log("DEBUG: Scroll prevention listeners removed");
    };
  }, []);
};
