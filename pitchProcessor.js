// pitchProcessor.js
// Motor de Autocorrelación YIN - Aislado en AudioWorklet

class PitchProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(2048);
        this.bufferIndex = 0;
        this.threshold = 0.15; // Tolerancia YIN
        this.sampleRate = 48000; // Se actualizará al recibir el primer bloque
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const channelData = input[0];
            
            // Llenar el buffer circular
            for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex++] = channelData[i];
                
                if (this.bufferIndex >= this.buffer.length) {
                    this.bufferIndex = 0;
                    this.detectPitchYIN();
                }
            }
        }
        return true; // Mantener vivo el procesador
    }

    detectPitchYIN() {
        // 1. Calcular la energía (Volumen/RMS) para la puerta de ruido
        let rms = 0;
        for (let i = 0; i < this.buffer.length; i++) {
            rms += this.buffer[i] * this.buffer[i];
        }
        rms = Math.sqrt(rms / this.buffer.length);
        
        // Convertir RMS a dB aproximados
        const db = 20 * Math.log10(rms + 0.0001);

        if (db < -55) {
            // Silencio, abortar matemática pesada
            this.port.postMessage({ pitch: -1, db: db });
            return;
        }

        // 2. Función de Diferencia YIN (Time-Domain)
        const halfBufferSize = Math.floor(this.buffer.length / 2);
        const yinBuffer = new Float32Array(halfBufferSize);

        for (let t = 1; t < halfBufferSize; t++) {
            for (let i = 0; i < halfBufferSize; i++) {
                const delta = this.buffer[i] - this.buffer[i + t];
                yinBuffer[t] += delta * delta;
            }
        }

        // 3. Diferencia Acumulativa Normalizada
        yinBuffer[0] = 1;
        yinBuffer[1] = 1;
        let runningSum = 0;
        for (let t = 1; t < halfBufferSize; t++) {
            runningSum += yinBuffer[t];
            yinBuffer[t] *= t / runningSum;
        }

        // 4. Búsqueda del Mínimo Absoluto (El Periodo Fundamental)
        let tau = -1;
        for (let t = 2; t < halfBufferSize; t++) {
            if (yinBuffer[t] < this.threshold) {
                while (t + 1 < halfBufferSize && yinBuffer[t + 1] < yinBuffer[t]) {
                    t++;
                }
                tau = t;
                break;
            }
        }

        if (tau === -1) {
            // Si no encontró por debajo del umbral, buscar el mínimo global
            let minVal = Infinity;
            for (let t = 2; t < halfBufferSize; t++) {
                if (yinBuffer[t] < minVal) {
                    minVal = yinBuffer[t];
                    tau = t;
                }
            }
        }

        // 5. Interpolación Parabólica para precisión Sub-Hercio
        let pitchInHz = -1;
        if (tau > 0 && tau < halfBufferSize - 1) {
            const s0 = yinBuffer[tau - 1];
            const s1 = yinBuffer[tau];
            const s2 = yinBuffer[tau + 1];
            const shift = 0.5 * (s2 - s0) / (2 * s1 - s2 - s0);
            pitchInHz = this.sampleRate / (tau + shift);
        }

        // Emitir resultados a la interfaz principal
        this.port.postMessage({ pitch: pitchInHz, db: db });
    }
}

registerProcessor('pitch-processor', PitchProcessor);
