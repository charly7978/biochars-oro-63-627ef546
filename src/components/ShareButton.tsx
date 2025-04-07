
import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { commonToasts } from "@/utils/toast-utils";

const APP_SHARE_URL = "https://healthpulse.app";

const ShareButton = () => {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    
    try {
      const shareData = {
        title: 'Biochars Health Monitor',
        text: 'Monitorea tu salud con Biochars Health Monitor',
        url: APP_SHARE_URL,
      };

      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        commonToasts.sharing.linkShared();
      } else {
        await navigator.clipboard.writeText(APP_SHARE_URL);
        commonToasts.sharing.linkCopied();
      }
    } catch (error) {
      // Only show toast for actual sharing errors
      if (error instanceof Error) {
        commonToasts.sharing.shareError();
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button 
      onClick={handleShare} 
      variant="outline" 
      size="icon" 
      className="rounded-full bg-black/30 border-none hover:bg-black/50"
      disabled={isSharing}
    >
      <Share2 className="h-5 w-5 text-white" />
    </Button>
  );
};

export default ShareButton;
