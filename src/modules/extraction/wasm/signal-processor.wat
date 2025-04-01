
(module
  ;; Memory for signal processing
  (memory (export "memory") 1)
  
  ;; Function to apply signal filtering
  (func $filterSignal (param $ptr i32) (param $length i32) (param $filterType i32) (result i32)
    (local $i i32)
    (local $sum f32)
    (local $value f32)
    (local $prevValue f32)
    (local $outputPtr i32)
    
    ;; Allocate output buffer
    (local.set $outputPtr (i32.const 4096))
    
    ;; Initialize loop
    (local.set $i (i32.const 0))
    (local.set $prevValue (f32.const 0))
    
    ;; Process each sample
    (block $loop_exit
      (loop $loop
        ;; Check if we've reached the end
        (br_if $loop_exit (i32.ge_u (local.get $i) (local.get $length)))
        
        ;; Load current value
        (local.set $value 
          (f32.load (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 4))))
        )
        
        ;; Apply filter based on filter type
        (if (i32.eq (local.get $filterType) (i32.const 1))
          ;; Low-pass filter
          (then
            (local.set $value 
              (f32.add 
                (f32.mul (f32.const 0.8) (local.get $prevValue))
                (f32.mul (f32.const 0.2) (local.get $value))
              )
            )
          )
        )
        
        (if (i32.eq (local.get $filterType) (i32.const 2))
          ;; High-pass filter
          (then
            (local.set $value 
              (f32.sub 
                (local.get $value)
                (f32.mul (f32.const 0.95) (local.get $prevValue))
              )
            )
          )
        )
        
        ;; Store filtered value in output buffer
        (f32.store 
          (i32.add (local.get $outputPtr) (i32.mul (local.get $i) (i32.const 4)))
          (local.get $value)
        )
        
        ;; Update previous value
        (local.set $prevValue (local.get $value))
        
        ;; Increment counter
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Loop back
        (br $loop)
      )
    )
    
    ;; Return pointer to output buffer
    (return (local.get $outputPtr))
  )
  
  ;; Function to detect peaks in signal
  (func $detectPeaks (param $ptr i32) (param $length i32) (param $threshold f32) (result i32)
    (local $i i32)
    (local $count i32)
    (local $current f32)
    (local $prev f32)
    (local $next f32)
    (local $resultPtr i32)
    
    ;; Initialize
    (local.set $i (i32.const 1))  ;; Start at second element
    (local.set $count (i32.const 0))
    (local.set $resultPtr (i32.const 8192))  ;; Different memory location
    
    ;; Process middle elements
    (block $loop_exit
      (loop $loop
        ;; Exit if we've reached the end - 1
        (br_if $loop_exit (i32.ge_u (local.get $i) (i32.sub (local.get $length) (i32.const 1))))
        
        ;; Load values
        (local.set $prev 
          (f32.load (i32.add (local.get $ptr) (i32.mul (i32.sub (local.get $i) (i32.const 1)) (i32.const 4))))
        )
        (local.set $current 
          (f32.load (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 4))))
        )
        (local.set $next 
          (f32.load (i32.add (local.get $ptr) (i32.mul (i32.add (local.get $i) (i32.const 1)) (i32.const 4))))
        )
        
        ;; Check if current is a peak
        (if (i32.and 
              (f32.gt (local.get $current) (local.get $prev))
              (f32.gt (local.get $current) (local.get $next))
            )
          (then
            ;; Check if peak exceeds threshold
            (if (f32.gt (local.get $current) (local.get $threshold))
              (then
                ;; Store peak position
                (i32.store 
                  (i32.add (local.get $resultPtr) (i32.mul (local.get $count) (i32.const 4)))
                  (local.get $i)
                )
                ;; Increment peak counter
                (local.set $count (i32.add (local.get $count) (i32.const 1)))
              )
            )
          )
        )
        
        ;; Increment counter
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Loop back
        (br $loop)
      )
    )
    
    ;; Store count at the beginning of result buffer
    (i32.store (local.get $resultPtr) (local.get $count))
    
    ;; Return pointer to result buffer
    (return (local.get $resultPtr))
  )
  
  ;; Function to calculate signal statistics
  (func $calculateStats (param $ptr i32) (param $length i32) (result i32)
    (local $i i32)
    (local $sum f32)
    (local $sumSquared f32)
    (local $min f32)
    (local $max f32)
    (local $value f32)
    (local $mean f32)
    (local $variance f32)
    (local $resultPtr i32)
    
    ;; Initialize
    (local.set $i (i32.const 0))
    (local.set $sum (f32.const 0))
    (local.set $sumSquared (f32.const 0))
    (local.set $min (f32.load (local.get $ptr)))  ;; Initialize min to first value
    (local.set $max (f32.load (local.get $ptr)))  ;; Initialize max to first value
    (local.set $resultPtr (i32.const 12288))  ;; Different memory location
    
    ;; Calculate sum, sum of squares, min, max
    (block $loop_exit
      (loop $loop
        ;; Exit if we've reached the end
        (br_if $loop_exit (i32.ge_u (local.get $i) (local.get $length)))
        
        ;; Load current value
        (local.set $value 
          (f32.load (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 4))))
        )
        
        ;; Update sum and sum of squares
        (local.set $sum (f32.add (local.get $sum) (local.get $value)))
        (local.set $sumSquared (f32.add (local.get $sumSquared) (f32.mul (local.get $value) (local.get $value))))
        
        ;; Update min if necessary
        (if (f32.lt (local.get $value) (local.get $min))
          (then (local.set $min (local.get $value)))
        )
        
        ;; Update max if necessary
        (if (f32.gt (local.get $value) (local.get $max))
          (then (local.set $max (local.get $value)))
        )
        
        ;; Increment counter
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        
        ;; Loop back
        (br $loop)
      )
    )
    
    ;; Calculate mean
    (local.set $mean (f32.div (local.get $sum) (f32.convert_i32_u (local.get $length))))
    
    ;; Calculate variance
    (local.set $variance 
      (f32.sub 
        (f32.div (local.get $sumSquared) (f32.convert_i32_u (local.get $length)))
        (f32.mul (local.get $mean) (local.get $mean))
      )
    )
    
    ;; Store statistics in result buffer
    (f32.store (i32.add (local.get $resultPtr) (i32.const 0)) (local.get $mean))
    (f32.store (i32.add (local.get $resultPtr) (i32.const 4)) (local.get $variance))
    (f32.store (i32.add (local.get $resultPtr) (i32.const 8)) (local.get $min))
    (f32.store (i32.add (local.get $resultPtr) (i32.const 12)) (local.get $max))
    
    ;; Return pointer to result buffer
    (return (local.get $resultPtr))
  )
  
  ;; Export functions
  (export "filterSignal" (func $filterSignal))
  (export "detectPeaks" (func $detectPeaks))
  (export "calculateStats" (func $calculateStats))
)
