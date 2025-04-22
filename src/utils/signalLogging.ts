import { LogLevel } from './signalNormalization';

interface SignalLogEntry {
  timestamp: number;
  value: number;
  filteredValue?: number;
  quality?: number;
  isPeak?: boolean;
  bpm?: number;
  confidence?: number;
  arrhythmiaCount?: number;
  isArrhythmia?: boolean;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  transition?: {
    active: boolean;
    progress: number;
    direction: 'none' | 'in' | 'out';
  };
}

interface SignalLog {
  [key: string]: SignalLogEntry[];
}

class SignalLoggingService {
  private log: SignalLog = {};
  private logLevel: LogLevel = LogLevel.NONE;
  private maxEntries: number = 500;

  constructor(logLevel: LogLevel = LogLevel.NONE, maxEntries: number = 500) {
    this.logLevel = logLevel;
    this.maxEntries = maxEntries;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public setMaxEntries(max: number): void {
    this.maxEntries = max;
  }

  public logSignal(sessionId: string, entry: SignalLogEntry): void {
    if (this.logLevel <= LogLevel.SIGNAL) {
      if (!this.log[sessionId]) {
        this.log[sessionId] = [];
      }

      this.log[sessionId].push(entry);

      if (this.log[sessionId].length > this.maxEntries) {
        this.log[sessionId].shift();
      }
    }
  }

  public getSignalLog(sessionId: string): SignalLogEntry[] {
    return this.log[sessionId] || [];
  }

  public clearSignalLog(sessionId: string): void {
    delete this.log[sessionId];
  }

  public getAllLogs(): SignalLog {
    return this.log;
  }

  public clearAllLogs(): void {
    this.log = {};
  }

  public logEvent(sessionId: string, eventName: string, eventData: any): void {
    if (this.logLevel <= LogLevel.EVENT) {
      console.log(`[Event - ${sessionId}] ${eventName}:`, eventData);
    }
  }

  public logError(sessionId: string, error: Error | string): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[Error - ${sessionId}]:`, error);
    }
  }

  public logWarning(sessionId: string, message: string): void {
    if (this.logLevel <= LogLevel.WARNING) {
      console.warn(`[Warning - ${sessionId}]:`, message);
    }
  }

  public debug(sessionId: string, message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(`[Debug - ${sessionId}]: ${message}`, data);
    }
  }

  public groupStart(sessionId: string, groupName: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.group(`[Group - ${sessionId}]: ${groupName}`);
    }
  }

  public groupEnd(sessionId: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  public table(sessionId: string, data: any, columns?: string[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.table(data, columns);
    }
  }

  public count(sessionId: string, label: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.count(`[Count - ${sessionId}]: ${label}`);
    }
  }

  public time(sessionId: string, label: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.time(`[Time - ${sessionId}]: ${label}`);
    }
  }

  public timeEnd(sessionId: string, label: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.timeEnd(`[Time - ${sessionId}]: ${label}`);
    }
  }

  public assert(sessionId: string, condition: boolean, message: string, ...data: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.assert(condition, `[Assert - ${sessionId}]: ${message}`, ...data);
    }
  }

  public trace(sessionId: string, message: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.trace(`[Trace - ${sessionId}]: ${message}`);
    }
  }

  public dir(sessionId: string, obj: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.dir(`[Dir - ${sessionId}]:`, obj);
    }
  }

  public dirxml(sessionId: string, ...data: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.dirxml(`[DirXML - ${sessionId}]:`, ...data);
    }
  }

  public profile(sessionId: string, label?: string): void {
    if (this.logLevel <= LogLevel.DEBUG && typeof console.profile === 'function') {
      console.profile(`[Profile - ${sessionId}]: ${label || 'Default Profile'}`);
    }
  }

  public profileEnd(sessionId: string): void {
    if (this.logLevel <= LogLevel.DEBUG && typeof console.profileEnd === 'function') {
      console.profileEnd();
    }
  }

  public timeStamp(sessionId: string, label?: string): void {
    if (this.logLevel <= LogLevel.DEBUG && typeof console.timeStamp === 'function') {
      console.timeStamp(`[TimeStamp - ${sessionId}]: ${label || 'Default TimeStamp'}`);
    }
  }

  public countReset(sessionId: string, label?: string): void {
    if (this.logLevel <= LogLevel.DEBUG && typeof console.countReset === 'function') {
      console.countReset(`[CountReset - ${sessionId}]: ${label || 'Default Count'}`);
    }
  }

  public clear(sessionId: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.clear();
    }
  }

  public getLogSize(sessionId: string): number {
    return this.log[sessionId] ? this.log[sessionId].length : 0;
  }

  public getAllLogSizes(): { [key: string]: number } {
    const sizes: { [key: string]: number } = {};
    for (const sessionId in this.log) {
      if (this.log.hasOwnProperty(sessionId)) {
        sizes[sessionId] = this.log[sessionId].length;
      }
    }
    return sizes;
  }

  public downloadLog(sessionId: string, filename: string = 'signal_log.json'): void {
    const logData = this.getSignalLog(sessionId);
    const json = JSON.stringify(logData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public downloadAllLogs(filename: string = 'all_signal_logs.json'): void {
    const allLogs = this.getAllLogs();
    const json = JSON.stringify(allLogs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public setLog(newLog: SignalLog) {
    this.log = newLog;
  }

  public getRawLogs(): SignalLog {
    return this.log;
  }

  public printLog(sessionId: string): void {
    const logData = this.getSignalLog(sessionId);
    console.log(`[Signal Log - ${sessionId}]:`, logData);
  }

  public printAllLogs(): void {
    console.log('All Signal Logs:', this.getAllLogs());
  }

  public getStats(sessionId: string): any {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return {
        entryCount: 0,
        minValue: null,
        maxValue: null,
        avgValue: null,
      };
    }

    let minValue = logData[0].value;
    let maxValue = logData[0].value;
    let sumValue = 0;

    for (const entry of logData) {
      minValue = Math.min(minValue, entry.value);
      maxValue = Math.max(maxValue, entry.value);
      sumValue += entry.value;
    }

    const avgValue = sumValue / logData.length;

    return {
      entryCount: logData.length,
      minValue,
      maxValue,
      avgValue,
    };
  }

  public getAllStats(): { [key: string]: any } {
    const allStats: { [key: string]: any } = {};
    for (const sessionId in this.log) {
      if (this.log.hasOwnProperty(sessionId)) {
        allStats[sessionId] = this.getStats(sessionId);
      }
    }
    return allStats;
  }

  public filterLog(sessionId: string, filterFn: (entry: SignalLogEntry) => boolean): SignalLogEntry[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return [];
    }
    return logData.filter(filterFn);
  }

  public mapLog<T>(sessionId: string, mapFn: (entry: SignalLogEntry) => T): T[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return [];
    }
    return logData.map(mapFn);
  }

  public reduceLog<T>(sessionId: string, reduceFn: (accumulator: T, entry: SignalLogEntry) => T, initialValue: T): T {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return initialValue;
    }
    return logData.reduce(reduceFn, initialValue);
  }

  public findInLog(sessionId: string, findFn: (entry: SignalLogEntry) => boolean): SignalLogEntry | undefined {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return undefined;
    }
    return logData.find(findFn);
  }

  public sortLog(sessionId: string, compareFn: (a: SignalLogEntry, b: SignalLogEntry) => number): SignalLogEntry[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return [];
    }
    return [...logData].sort(compareFn);
  }

  public forEachLog(sessionId: string, forEachFn: (entry: SignalLogEntry, index: number, array: SignalLogEntry[]) => void): void {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return;
    }
    logData.forEach(forEachFn);
  }

  public everyInLog(sessionId: string, everyFn: (entry: SignalLogEntry) => boolean): boolean {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return true;
    }
    return logData.every(everyFn);
  }

  public someInLog(sessionId: string, someFn: (entry: SignalLogEntry) => boolean): boolean {
    const logData = this.getSignalLog(sessionId);
    if (!logData) {
      return false;
    }
    return logData.some(someFn);
  }

  public getLogEntries(sessionId: string): SignalLogEntry[] | undefined {
    return this.log[sessionId];
  }

  public getFirstLogEntry(sessionId: string): SignalLogEntry | undefined {
    const logEntries = this.getLogEntries(sessionId);
    return logEntries ? logEntries[0] : undefined;
  }

  public getLastLogEntry(sessionId: string): SignalLogEntry | undefined {
    const logEntries = this.getLogEntries(sessionId);
    return logEntries ? logEntries[logEntries.length - 1] : undefined;
  }

  public getLogEntryAtIndex(sessionId: string, index: number): SignalLogEntry | undefined {
    const logEntries = this.getLogEntries(sessionId);
    return logEntries ? logEntries[index] : undefined;
  }

  public getLogLength(sessionId: string): number {
    const logEntries = this.getLogEntries(sessionId);
    return logEntries ? logEntries.length : 0;
  }

  public logExists(sessionId: string): boolean {
    return !!this.log[sessionId];
  }

  public isLogEmpty(sessionId: string): boolean {
    const logEntries = this.getLogEntries(sessionId);
    return !logEntries || logEntries.length === 0;
  }

  public clearLogsOlderThan(sessionId: string, timestamp: number): void {
    if (!this.log[sessionId]) {
      return;
    }
    this.log[sessionId] = this.log[sessionId].filter(entry => entry.timestamp >= timestamp);
  }

  public clearLogsNewerThan(sessionId: string, timestamp: number): void {
    if (!this.log[sessionId]) {
      return;
    }
    this.log[sessionId] = this.log[sessionId].filter(entry => entry.timestamp <= timestamp);
  }

  public findNearestLogEntry(sessionId: string, timestamp: number): SignalLogEntry | undefined {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return undefined;
    }

    let nearestEntry: SignalLogEntry | undefined;
    let minDifference = Infinity;

    for (const entry of logData) {
      const difference = Math.abs(entry.timestamp - timestamp);
      if (difference < minDifference) {
        minDifference = difference;
        nearestEntry = entry;
      }
    }

    return nearestEntry;
  }

  public findLogEntriesWithinRange(sessionId: string, startTime: number, endTime: number): SignalLogEntry[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return [];
    }

    return logData.filter(entry => entry.timestamp >= startTime && entry.timestamp <= endTime);
  }

  public calculateAverageValue(sessionId: string): number | null {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return null;
    }

    const sum = logData.reduce((acc, entry) => acc + entry.value, 0);
    return sum / logData.length;
  }

  public calculateMedianValue(sessionId: string): number | null {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return null;
    }

    const values = logData.map(entry => entry.value).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);

    if (values.length % 2 === 0) {
      return (values[mid - 1] + values[mid]) / 2;
    } else {
      return values[mid];
    }
  }

  public calculateStandardDeviation(sessionId: string): number | null {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return null;
    }

    const avg = this.calculateAverageValue(sessionId);
    if (avg === null) {
      return null;
    }

    const squareDiffs = logData.map(entry => Math.pow(entry.value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  public detectAnomalies(sessionId: string, threshold: number): SignalLogEntry[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return [];
    }

    const avg = this.calculateAverageValue(sessionId);
    const stdDev = this.calculateStandardDeviation(sessionId);

    if (avg === null || stdDev === null) {
      return [];
    }

    return logData.filter(entry => Math.abs(entry.value - avg) > threshold * stdDev);
  }

  public findMaxValueEntry(sessionId: string): SignalLogEntry | undefined {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return undefined;
    }

    let maxValue = -Infinity;
    let maxValueEntry: SignalLogEntry | undefined;

    for (const entry of logData) {
      if (entry.value > maxValue) {
        maxValue = entry.value;
        maxValueEntry = entry;
      }
    }

    return maxValueEntry;
  }

  public findMinValueEntry(sessionId: string): SignalLogEntry | undefined {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return undefined;
    }

    let minValue = Infinity;
    let minValueEntry: SignalLogEntry | undefined;

    for (const entry of logData) {
      if (entry.value < minValue) {
        minValue = entry.value;
        minValueEntry = entry;
      }
    }

    return minValueEntry;
  }

  public calculateValueChangeRate(sessionId: string): number | null {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length < 2) {
      return null;
    }

    const firstValue = logData[0].value;
    const lastValue = logData[logData.length - 1].value;
    const timeDiff = logData[logData.length - 1].timestamp - logData[0].timestamp;

    return (lastValue - firstValue) / timeDiff;
  }

  public calculateMovingAverage(sessionId: string, windowSize: number): { timestamp: number; average: number }[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length < windowSize) {
      return [];
    }

    const movingAverages: { timestamp: number; average: number }[] = [];

    for (let i = windowSize - 1; i < logData.length; i++) {
      let sum = 0;
      for (let j = i - windowSize + 1; j <= i; j++) {
        sum += logData[j].value;
      }
      const average = sum / windowSize;
      movingAverages.push({ timestamp: logData[i].timestamp, average });
    }

    return movingAverages;
  }

  public calculateExponentialMovingAverage(sessionId: string, alpha: number): { timestamp: number; average: number }[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return [];
    }

    const movingAverages: { timestamp: number; average: number }[] = [];
    let lastAverage = logData[0].value;

    for (let i = 1; i < logData.length; i++) {
      const average = alpha * logData[i].value + (1 - alpha) * lastAverage;
      movingAverages.push({ timestamp: logData[i].timestamp, average });
      lastAverage = average;
    }

    return movingAverages;
  }

  public detectSpikes(sessionId: string, threshold: number): SignalLogEntry[] {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length < 2) {
      return [];
    }

    const spikes: SignalLogEntry[] = [];

    for (let i = 1; i < logData.length; i++) {
      const diff = logData[i].value - logData[i - 1].value;
      if (Math.abs(diff) > threshold) {
        spikes.push(logData[i]);
      }
    }

    return spikes;
  }

  public calculateCorrelation(sessionId1: string, sessionId2: string): number | null {
    const logData1 = this.getSignalLog(sessionId1);
    const logData2 = this.getSignalLog(sessionId2);

    if (!logData1 || !logData2 || logData1.length !== logData2.length || logData1.length === 0) {
      return null;
    }

    const avg1 = logData1.reduce((acc, entry) => acc + entry.value, 0) / logData1.length;
    const avg2 = logData2.reduce((acc, entry) => acc + entry.value, 0) / logData2.length;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < logData1.length; i++) {
      numerator += (logData1[i].value - avg1) * (logData2[i].value - avg2);
      denom1 += Math.pow(logData1[i].value - avg1, 2);
      denom2 += Math.pow(logData2[i].value - avg2, 2);
    }

    if (denom1 === 0 || denom2 === 0) {
      return null;
    }

    return numerator / (Math.sqrt(denom1) * Math.sqrt(denom2));
  }

  public calculateCrossCorrelation(sessionId1: string, sessionId2: string, lag: number): number | null {
    const logData1 = this.getSignalLog(sessionId1);
    const logData2 = this.getSignalLog(sessionId2);

    if (!logData1 || !logData2 || logData1.length !== logData2.length || logData1.length <= Math.abs(lag)) {
      return null;
    }

    let sum = 0;
    let count = 0;

    for (let i = Math.max(0, lag); i < Math.min(logData1.length, logData1.length + lag); i++) {
      sum += logData1[i].value * logData2[i - lag].value;
      count++;
    }

    return sum / count;
  }

  public calculateAutocorrelation(sessionId: string, lag: number): number | null {
    const logData = this.getSignalLog(sessionId);

    if (!logData || logData.length <= Math.abs(lag)) {
      return null;
    }

    let sum = 0;
    let count = 0;

    for (let i = Math.max(0, lag); i < logData.length; i++) {
      sum += logData[i].value * logData[i - lag].value;
      count++;
    }

    return sum / count;
  }

  public calculateEntropy(sessionId: string): number | null {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return null;
    }

    const valueCounts: { [value: number]: number } = {};
    for (const entry of logData) {
      const value = Math.round(entry.value * 100) / 100;
      valueCounts[value] = (valueCounts[value] || 0) + 1;
    }

    let entropy = 0;
    for (const value in valueCounts) {
      const probability = valueCounts[value] / logData.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  public calculateFractalDimension(sessionId: string, boxSize: number): number | null {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length === 0) {
      return null;
    }

    let coveredBoxes = new Set<string>();

    for (const entry of logData) {
      const x = Math.floor(entry.value / boxSize);
      const y = Math.floor(entry.timestamp / boxSize);
      coveredBoxes.add(`${x},${y}`);
    }

    return Math.log(coveredBoxes.size) / Math.log(1 / boxSize);
  }

  public calculateLyapunovExponent(sessionId: string, delay: number, embeddingDimension: number): number | null {
    const logData = this.getSignalLog(sessionId);
    if (!logData || logData.length < delay * (embeddingDimension + 1)) {
      return null;
    }

    let sumDivergence = 0;
    let count = 0;

    for (let i = 0; i < logData.length - delay * (embeddingDimension + 1); i++) {
      let minDistance = Infinity;
      let nearestNeighborIndex = -1;

      for (let j = 0; j < logData.length - delay * (embeddingDimension + 1); j++) {
        if (i === j) continue;

        let distance = 0;
        for (let k = 0; k < embeddingDimension; k++) {
          distance += Math.pow(logData[i + k * delay].value - logData[j + k * delay].value, 2);
        }
        distance = Math.sqrt(distance);

        if (distance < minDistance) {
          minDistance = distance;
          nearestNeighborIndex = j;
        }
      }

      if (nearestNeighborIndex !== -1) {
        const divergence = Math.abs(logData[i + embeddingDimension * delay].value - logData[nearestNeighborIndex + embeddingDimension * delay].value);
        sumDivergence += Math.log(divergence / minDistance);
        count++;
      }
    }

    return count > 0 ? sumDivergence / count : null;
  }
}

const signalLoggingService = new SignalLoggingService();
export default signalLoggingService;
