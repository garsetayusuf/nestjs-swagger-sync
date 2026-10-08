import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { ApiTestOutputMode } from './interfaces/swagger-sync-config.interface.js';
import type {
  CollectionNode,
  PostmanCollection,
  PostmanHeader,
  PostmanRequest,
} from './postman-collection.js';
import { isPostmanFolder } from './postman-collection.js';

interface TestResult {
  Method: string;
  URL: string;
  Status: string | number;
  ResponseTime: string;
  ResponseTimeMs: number;
  DataSize: number;
  Result: string;
  Passed: boolean;
}

type DataListener = (dataSize: number, success: boolean) => void;

@Injectable()
export class ApiTestService {
  private readonly axiosInstance: AxiosInstance;
  private isRunning = false;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 5000,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });
  }

  async runTestsInBackground(
    collection: PostmanCollection,
    baseUrl: string,
    outputMode: ApiTestOutputMode = 'compact',
  ): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      await this.executeTests(collection, baseUrl, outputMode);
    } catch (error) {
      console.error(
        chalk.red('Test execution failed:'),
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async executeTests(
    collection: PostmanCollection,
    baseUrl: string,
    outputMode: ApiTestOutputMode,
  ): Promise<void> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    const responseTimes: number[] = [];
    let totalDataReceived = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    console.log(chalk.blue(`API tests ${baseUrl}`));
    for (const folder of collection.item) {
      await this.testFolderEndpoints(
        folder,
        baseUrl,
        results,
        responseTimes,
        (dataSize, success) => {
          totalDataReceived += dataSize;
          if (success) {
            successfulRequests++;
          } else {
            failedRequests++;
          }
        },
      );
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (outputMode === 'compact') {
      this.displayCompact(results, responseTimes, totalDataReceived, duration);
    } else {
      this.displayTable(
        results,
        responseTimes,
        totalDataReceived,
        successfulRequests,
        failedRequests,
        duration,
      );
    }
    console.log(chalk.green('Tests completed.'));
  }

  private async testFolderEndpoints(
    folder: CollectionNode,
    baseUrl: string,
    results: TestResult[],
    responseTimes: number[],
    onDataReceived: DataListener,
  ): Promise<void> {
    if (isPostmanFolder(folder)) {
      for (const item of folder.item) {
        await this.testFolderEndpoints(item, baseUrl, results, responseTimes, onDataReceived);
      }
      return;
    }

    await this.testEndpoint(folder.request, baseUrl, results, responseTimes, onDataReceived);
  }

  private async testEndpoint(
    request: PostmanRequest,
    baseUrl: string,
    results: TestResult[],
    responseTimes: number[],
    onDataReceived: DataListener,
  ): Promise<void> {
    const url = ApiTestService.buildUrl(baseUrl, request.url.path);
    const method = request.method.toUpperCase();
    const startTime = Date.now();

    try {
      const response = await this.axiosInstance({
        method: request.method.toLowerCase(),
        url,
        headers: ApiTestService.toHeaders(request.header),
        responseType: 'arraybuffer',
      });

      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);

      if (!response) {
        onDataReceived(0, false);
        results.push({
          Method: method,
          URL: url,
          Status: 'No Response',
          ResponseTime: `${responseTime}ms`,
          ResponseTimeMs: responseTime,
          DataSize: 0,
          Result: 'Fail',
          Passed: false,
        });
        return;
      }

      const dataSize = ApiTestService.measureBody(response.data);
      const passed = response.status < 300;
      onDataReceived(dataSize, passed);
      results.push({
        Method: method,
        URL: url,
        Status: response.status,
        ResponseTime: `${responseTime}ms`,
        ResponseTimeMs: responseTime,
        DataSize: dataSize,
        Result: passed ? 'Pass' : 'Fail',
        Passed: passed,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
      onDataReceived(0, false);
      const status = axios.isAxiosError(error) ? (error.code ?? 'Error') : 'Error';
      results.push({
        Method: method,
        URL: url,
        Status: status,
        ResponseTime: `${responseTime}ms`,
        ResponseTimeMs: responseTime,
        DataSize: 0,
        Result: 'Fail',
        Passed: false,
      });
    }
  }

  private static buildUrl(baseUrl: string, pathSegments: string[]): string {
    const cleanBase = (baseUrl || '').replace(/\/+$/, '');
    const cleanPath = (pathSegments || [])
      .filter((segment): segment is string => typeof segment === 'string' && segment.length > 0)
      .join('/')
      .replace(/^\/+/, '');
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
  }

  private static toHeaders(headers: PostmanHeader[]): Record<string, string> {
    const result: Record<string, string> = {};
    if (!Array.isArray(headers)) {
      return result;
    }
    for (const header of headers) {
      if (
        typeof header !== 'object' ||
        header === null ||
        typeof header.key !== 'string' ||
        header.key.length === 0 ||
        typeof header.value !== 'string' ||
        header.value.length === 0
      ) {
        continue;
      }
      result[header.key] = header.value;
    }
    return result;
  }

  private static measureBody(data: unknown): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data);
    }
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }
    if (typeof data === 'object' && data !== null) {
      try {
        return Buffer.byteLength(JSON.stringify(data));
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private displayCompact(
    results: TestResult[],
    responseTimes: number[],
    totalDataReceived: number,
    duration: string,
  ): void {
    for (const result of results) {
      const mark = result.Passed ? chalk.green('[PASS]') : chalk.red('[FAIL]');
      console.log(
        `${mark} ${result.Method} ${result.URL} [${result.Status} | ${result.ResponseTime} | ${ApiTestService.formatBytes(result.DataSize)}]`,
      );
    }
    const passed = results.filter((result) => result.Passed).length;
    const failed = results.length - passed;
    console.log(
      chalk.green.bold(
        `${results.length} requests: ${passed} passed, ${failed} failed (${duration}s, avg ${ApiTestService.average(responseTimes)}ms, ${ApiTestService.formatBytes(totalDataReceived)})`,
      ),
    );
  }

  private displayTable(
    results: TestResult[],
    responseTimes: number[],
    totalDataReceived: number,
    successfulRequests: number,
    failedRequests: number,
    duration: string,
  ): void {
    const table = new Table({
      head: [
        chalk.cyan('Method'),
        chalk.cyan('URL'),
        chalk.cyan('Status'),
        chalk.cyan('Response Time'),
        chalk.cyan('Result'),
      ],
      colWidths: [10, 40, 10, 15, 15],
    });

    for (const result of results) {
      table.push([result.Method, result.URL, result.Status, result.ResponseTime, result.Result]);
    }

    const avgResponseTime = ApiTestService.average(responseTimes);
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const stdDevResponseTime = ApiTestService.standardDeviation(
      responseTimes,
      Number(avgResponseTime),
    );

    table.push([
      {
        colSpan: 5,
        content: chalk.green.bold(
          `Total request: ${successfulRequests} Pass, ${failedRequests} Fail`,
        ),
      },
    ]);
    table.push([
      {
        colSpan: 5,
        content: chalk.green.bold(`Total run duration: ${duration}s`),
      },
    ]);
    table.push([
      {
        colSpan: 5,
        content: chalk.green.bold(
          `Total Data Received: ${ApiTestService.formatBytes(totalDataReceived)} (approx)`,
        ),
      },
    ]);
    table.push([
      {
        colSpan: 5,
        content: chalk.green.bold(
          `Average Response Time: ${avgResponseTime}ms [min: ${minResponseTime}ms, max: ${maxResponseTime}ms, s.d.: ${stdDevResponseTime}ms]`,
        ),
      },
    ]);

    console.log(table.toString());
  }

  private static average(times: number[]): string {
    if (times.length === 0) {
      return '0.00';
    }
    const sum = times.reduce((total, time) => total + time, 0);
    return (sum / times.length).toFixed(2);
  }

  private static standardDeviation(times: number[], avg: number): string {
    if (times.length === 0) {
      return '0.00';
    }
    const squareDiffs = times.map((time) => Math.pow(time - avg, 2));
    const avgSquareDiff = Number(ApiTestService.average(squareDiffs));
    return Math.sqrt(avgSquareDiff).toFixed(2);
  }

  private static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'kB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${sizes[index]}`;
  }
}
