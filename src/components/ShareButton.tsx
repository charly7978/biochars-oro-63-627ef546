import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const APP_SHARE_URL = "https://lovable.dev/projects/2167cf4a-c624-4a88-bc63-c56d9dfa1dc7"; // Updated to the actual project URL

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
        toast({
          title: "Compartido",
          description: "Enlace compartido exitosamente",
        });
      } else {
        // Fallback to clipboard copy
        await navigator.clipboard.writeText(APP_SHARE_URL);
        toast({
          title: "Enlace copiado",
          description: "El enlace ha sido copiado al portapapeles: " + APP_SHARE_URL,
        });
      }
    } catch (error) {
      console.error("Error sharing: ", error);
      toast({
        title: "Error al compartir",
        description: "No se pudo compartir el enlace: " + APP_SHARE_URL,
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Button 
        onClick={handleShare} 
        variant="outline" 
        size="icon" 
        className="rounded-full bg-black/30 border-none hover:bg-black/50 mb-1"
        disabled={isSharing}
      >
        <Share2 className="h-5 w-5 text-white" />
      </Button>
      <span className="text-xs text-white bg-black/50 px-2 py-1 rounded-md">
        {APP_SHARE_URL}
      </span>
    </div>
  );
};

export default ShareButton;
