
import React, { useRef, useEffect } from 'react';

interface VideoStreamProps {
  stream: MediaStream | null;
}

const VideoStream = ({ stream }: VideoStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      // First make sure any existing srcObject is removed to prevent InvalidStateError
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
      
      try {
        // Set a short timeout to ensure clean state before setting new source
        setTimeout(() => {
          if (videoRef.current && stream.active) {
            videoRef.current.srcObject = stream;
            
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play().catch(err => {
                  console.error("Error playing video:", err);
                });
              }
            };
          }
        }, 100);
      } catch (videoErr) {
        console.error("VideoStream: Error setting video source:", videoErr);
      }
    } else if (!stream && videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Cleanup function
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    />
  );
};

export default VideoStream;
