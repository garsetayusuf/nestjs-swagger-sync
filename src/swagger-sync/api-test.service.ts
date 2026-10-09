import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import chalk from 'chalk';
import Table from 'cli-table3';
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

  async runTestsInBackground(collection: PostmanCollection, baseUrl: string): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      await this.executeTests(collection, baseUrl);
    } catch (error) {
      console.error(
        chalk.red('Test execution failed:'),
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async executeTests(collection: PostmanCollection, baseUrl: string): Promise<void> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    const responseTimes: number[] = [];
    let totalDataReceived = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    console.log(chalk.blue(`API tests · ${baseUrl}`));
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
    this.displayTable(
      results,
      responseTimes,
      totalDataReceived,
      successfulRequests,
      failedRequests,
      duration,
    );
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
      colWidths: [10, 78, 10, 15, 15],
      wordWrap: true,
    });

    for (const result of results) {
      const status = typeof result.Status === 'number' ? result.Status : undefined;
      const coloredStatus =
        status === undefined
          ? chalk.red(String(result.Status))
          : status >= 500
            ? chalk.red(String(status))
            : status >= 400
              ? chalk.yellow(String(status))
              : status >= 300
                ? chalk.cyan(String(status))
                : chalk.green(String(status));
      const coloredResult = result.Passed ? chalk.green('Pass') : chalk.red('Fail');
      table.push([
        chalk.cyan(result.Method),
        result.URL,
        coloredStatus,
        result.ResponseTime,
        coloredResult,
      ]);
    }

    const avgResponseTime = ApiTestService.average(responseTimes);
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const p95ResponseTime = ApiTestService.percentile(responseTimes, 0.95);
    const stdDevResponseTime = ApiTestService.standardDeviation(
      responseTimes,
      Number(avgResponseTime),
    );
    const statusCounts = new Map<string, number>();
    let blockedRequests = 0;
    let timeoutRequests = 0;
    let networkErrors = 0;

    for (const result of results) {
      const status = String(result.Status);
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
      if (result.Status === 401 || result.Status === 403) {
        blockedRequests++;
      } else if (
        typeof result.Status === 'string' &&
        ['ECONNABORTED', 'ETIMEDOUT', 'TIMEOUT'].includes(result.Status)
      ) {
        timeoutRequests++;
      } else if (typeof result.Status === 'string' && !result.Passed) {
        networkErrors++;
      }
    }

    const passRate =
      results.length > 0 ? ((successfulRequests / results.length) * 100).toFixed(2) : '0.00';
    const statusBreakdown = [...statusCounts.entries()]
      .filter(([status]) => /^\d+$/.test(status))
      .map(([status, count]) => `${status}: ${count}`)
      .join('  ·  ');

    table.push([
      {
        colSpan: 5,
        content: [
          chalk.bold('Total requests: '),
          chalk.green(`${successfulRequests} passed`),
          chalk.dim('  ·  '),
          chalk.red(`${failedRequests} failed`),
          chalk.dim(`  ·  Pass rate: ${passRate}%`),
        ].join(''),
      },
    ]);
    table.push([
      {
        colSpan: 5,
        content: chalk.bold(`Status breakdown: ${statusBreakdown || 'none'}`),
      },
    ]);
    table.push([
      {
        colSpan: 5,
        content: [
          chalk.bold('Blocked: '),
          chalk.yellow(String(blockedRequests)),
          chalk.dim('  ·  '),
          chalk.bold('Timeouts: '),
          chalk.yellow(String(timeoutRequests)),
          chalk.dim('  ·  '),
          chalk.bold('Network errors: '),
          chalk.yellow(String(networkErrors)),
        ].join(''),
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
          `Response Time: avg ${avgResponseTime}ms [min: ${minResponseTime}ms, max: ${maxResponseTime}ms, p95: ${p95ResponseTime}ms, s.d.: ${stdDevResponseTime}ms]`,
        ),
      },
    ]);

    console.log(table.toString());
  }

  private static percentile(times: number[], percentile: number): string {
    if (times.length === 0) {
      return '0.00';
    }
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1);
    return sorted[index].toFixed(2);
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
