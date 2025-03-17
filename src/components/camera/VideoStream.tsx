
import React, { useRef, useEffect } from 'react';

interface VideoStreamProps {
  stream: MediaStream | null;
}

const VideoStream = ({ stream }: VideoStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      // First remove any existing srcObject to prevent InvalidStateError
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
      
      try {
        // Set the stream and play
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error("Error playing video:", err);
            });
          }
        };
      } catch (videoErr) {
        console.error("VideoStream: Error setting video source:", videoErr);
      }
    } else if (!stream && videoRef.current) {
      videoRef.current.srcObject = null;
    }
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
