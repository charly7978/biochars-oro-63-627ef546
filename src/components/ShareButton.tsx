
import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const ShareButton = () => {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    
    try {
      const shareData = {
        title: 'Biochars Health Monitor',
        text: 'Check your vital signs with Biochars Health Monitor!',
        url: window.location.href,
      };

      if (navigator.share && navigator.canShare(shareData)) {
        // Use Web Share API if available
        await navigator.share(shareData);
      } else {
        // Fallback to clipboard copy
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Enlace copiado",
          description: "El enlace ha sido copiado al portapapeles",
        });
      }
    } catch (error) {
      console.error("Error sharing: ", error);
      toast({
        title: "Error al compartir",
        description: "No se pudo compartir el enlace",
        variant: "destructive",
      });
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
