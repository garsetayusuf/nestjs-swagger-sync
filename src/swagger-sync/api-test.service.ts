import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as Table from 'cli-table3';
interface Result {
  Method: Table.Cell;
  URL: Table.Cell;
  Status: Table.Cell;
  ResponseTime: Table.Cell;
  Result: Table.Cell;
}

@Injectable()
export class ApiTestService {
  private readonly axiosInstance: AxiosInstance;
  private isRunning = false;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 5000,
      validateStatus: () => true,
    });
  }

  async runTestsInBackground(collection: any, baseUrl: string): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      await this.executeTests(collection, baseUrl);
    } catch (error) {
      console.error(chalk.red('❌ Test execution failed:'), error.message);
    } finally {
      this.isRunning = false;
    }
  }

  private async executeTests(collection: any, baseUrl: string): Promise<void> {
    const startTime = Date.now();
    const results = [];
    const responseTimes: number[] = [];
    let totalDataReceived = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    console.log(
      chalk.blue(
        '\n ==================================== 🚀 Starting API tests ====================================\n',
      ),
    );
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
    this.displayResults(
      results,
      responseTimes,
      totalDataReceived,
      successfulRequests,
      failedRequests,
      duration,
    );
    console.log(
      chalk.green(
        '\n ===================================== Tests completed ✅ =====================================\n',
      ),
    );
  }

  private async testFolderEndpoints(
    folder: any,
    baseUrl: string,
    results: any,
    responseTimes: number[],
    onDataReceived: (dataSize: number, success: boolean) => void,
  ): Promise<void> {
    if (Array.isArray(folder.item)) {
      for (const item of folder.item) {
        await this.testFolderEndpoints(
          item,
          baseUrl,
          results,
          responseTimes,
          onDataReceived,
        );
      }
    } else if (folder.request) {
      await this.testEndpoint(
        folder.request,
        baseUrl,
        results,
        responseTimes,
        onDataReceived,
      );
    }
  }

  private async testEndpoint(
    request: any,
    baseUrl: string,
    results: any,
    responseTimes: number[],
    onDataReceived: (dataSize: number, success: boolean) => void,
  ): Promise<void> {
    const url = this.buildUrl(baseUrl, request.url.path);
    const method = request.method.toUpperCase();
    const startTime = Date.now();
    let status, responseTime, dataSize;
    let success = false;

    try {
      const response = await this.axiosInstance({
        method: request.method.toLowerCase(),
        url,
        headers: this.convertHeaders(request.header),
      });

      // Check if response exists
      if (response) {
        status = response.status;
        dataSize = Buffer.byteLength(JSON.stringify(response.data));
        success = true;
        responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        onDataReceived(dataSize, success);

        results.push({
          Method: method,
          URL: url,
          Status: status,
          ResponseTime: responseTime + 'ms',
          Success: '✅ Pass',
        });
      } else {
        status = 'No Response';
        responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        dataSize = 0;
        success = false;

        onDataReceived(dataSize, success);

        results.push({
          Method: method,
          URL: url,
          Status: status,
          ResponseTime: responseTime + 'ms',
        });
      }
    } catch (error) {
      responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
      dataSize = 0;
      success = false;

      // Check for timeout or no response error
      if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
        status = 'Error';
        onDataReceived(dataSize, success);
        results.push({
          Method: method,
          URL: url,
          Status: status,
          ResponseTime: responseTime + 'ms',
          Success: '❌ Fail',
        });
      } else {
        // Handle other errors
        status = 'Error';
        onDataReceived(dataSize, success);
        results.push({
          Method: method,
          URL: url,
          Status: status,
          ResponseTime: responseTime + 'ms',
          Success: '❌ Fail',
        });
      }
    }
  }

  private buildUrl(baseUrl: string, pathSegments: string[]): string {
    return `${baseUrl}/${pathSegments.join('/')}`.replace(/([^:]\/)/g, '$1');
  }

  private convertHeaders(headers: any[]): Record<string, string> {
    return headers.reduce((acc, header) => {
      if (header && header.key && header.value) {
        acc[header.key] = header.value;
      }
      return acc;
    }, {});
  }

  private displayResults(
    results: Result[],
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

    results.forEach((result) => table.push(Object.values(result).flat()));

    const avgResponseTime = this.calculateAverage(responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const stdDevResponseTime = this.calculateStandardDeviation(
      responseTimes,
      Number(avgResponseTime),
    );

    table.push([
      {
        colSpan: 5,
        content: chalk.green.bold(
          `Total request: ${successfulRequests} ✅ Pass, ${failedRequests} ❌ Fail`,
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
          `Total Data Received: ${this.formatBytes(
            totalDataReceived,
          )} (approx)`,
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

  private calculateAverage(times: number[]): string {
    const sum = times.reduce((a, b) => a + b, 0);
    return (sum / times.length).toFixed(2);
  }

  private calculateStandardDeviation(times: number[], avg: number): string {
    const squareDiffs = times.map((time) => Math.pow(time - avg, 2));
    const avgSquareDiff = this.calculateAverage(squareDiffs);
    return Math.sqrt(Number(avgSquareDiff)).toFixed(2);
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'kB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }
}
