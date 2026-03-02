/**
 * network
 *
 * network
 * - System
 */
import { runCommand, runMacCommand, formatBytesPerSec, convertToBytes } from './utils';
import { INetworkInfo } from './types';
import { logger } from '@withwiz/logger/logger';

export async function getNetworkInfo(): Promise<INetworkInfo> {
  try {
    const platform = process.platform;
    let connectionsOutput: string;
    let processConnectionsCount = 0;

    // 시스템 전체 ESTABLISHED 연결 수
    if (platform === 'darwin') {
      connectionsOutput = await runMacCommand("netstat -an | grep ESTABLISHED | wc -l");
    } else {
      connectionsOutput = await runCommand("netstat -an | grep ESTABLISHED | wc -l");
    }

    // Node.js 프로세스의 연결 수 조회
    const pid = process.pid;
    try {
      if (platform === 'darwin') {
        // macOS: lsof로 현재 프로세스의 네트워크 연결 수 조회
        const processOutput = await runMacCommand(`lsof -i -a -p ${pid} 2>/dev/null | grep ESTABLISHED | wc -l`);
        processConnectionsCount = parseInt(processOutput.trim()) || 0;
      } else {
        // Linux: /proc/{pid}/fd 또는 ss 명령어 사용
        try {
          const processOutput = await runCommand(`ls -la /proc/${pid}/fd 2>/dev/null | grep socket | wc -l`);
          processConnectionsCount = parseInt(processOutput.trim()) || 0;
        } catch {
          // ss 명령어로 fallback
          const ssOutput = await runCommand(`ss -tnp 2>/dev/null | grep "pid=${pid}" | wc -l`);
          processConnectionsCount = parseInt(ssOutput.trim()) || 0;
        }
      }
    } catch (error) {
      logger.debug('Process connections count failed:', error);
      processConnectionsCount = 0;
    }

    // Node.js 프로세스의 네트워크 사용량 조회 함수
    const getProcessNetworkStats = async (): Promise<{ rx: number; tx: number }> => {
      try {
        if (platform === 'darwin') {
          // macOS: nettop으로 특정 프로세스의 네트워크 통계 조회
          try {
            const nettopOutput = await runMacCommand(`nettop -J bytes_in,bytes_out -l 1 -p ${pid} 2>/dev/null`);
            let totalRx = 0, totalTx = 0;
            const lines = nettopOutput.split('\n').filter(line => line.trim());

            for (const line of lines) {
              const bytesMatch = line.match(/(\d+(?:\.\d+)?)\s+(B|KiB|MiB|GiB)\s+(\d+(?:\.\d+)?)\s+(B|KiB|MiB|GiB)/);
              if (bytesMatch) {
                const rxValue = parseFloat(bytesMatch[1]);
                const rxUnit = bytesMatch[2];
                const txValue = parseFloat(bytesMatch[3]);
                const txUnit = bytesMatch[4];

                totalRx += convertToBytes(rxValue, rxUnit);
                totalTx += convertToBytes(txValue, txUnit);
              }
            }

            return { rx: totalRx, tx: totalTx };
          } catch {
            // lsof fallback - 연결 수 기반 추정
            return { rx: 0, tx: 0 };
          }
        } else {
          // Linux: /proc/{pid}/net/dev 또는 /proc/{pid}/io 사용
          try {
            const ioOutput = await runCommand(`cat /proc/${pid}/io 2>/dev/null`);
            let rx = 0, tx = 0;

            const readMatch = ioOutput.match(/read_bytes:\s+(\d+)/);
            const writeMatch = ioOutput.match(/write_bytes:\s+(\d+)/);

            if (readMatch) rx = parseInt(readMatch[1]) || 0;
            if (writeMatch) tx = parseInt(writeMatch[1]) || 0;

            return { rx, tx };
          } catch {
            return { rx: 0, tx: 0 };
          }
        }
      } catch {
        return { rx: 0, tx: 0 };
      }
    };

    // 실시간 네트워크 속도 측정
    const getNetworkStats = async (): Promise<{ rx: number; tx: number }> => {
      if (platform === 'darwin') {
        // macOS: nettop 명령어로 전체 시스템 네트워크 통계 집계
        try {
          // 방법 1: nettop 명령어 사용
          const nettopOutput = await runMacCommand("nettop -J bytes_in,bytes_out -l 1 -s 1");

          let totalRx = 0, totalTx = 0;
          const lines = nettopOutput.split('\n').filter(line => line.trim());

          for (const line of lines) {
            // bytes_in과 bytes_out 컬럼에서 값 추출
            const bytesMatch = line.match(/(\d+(?:\.\d+)?)\s+(B|KiB|MiB|GiB)\s+(\d+(?:\.\d+)?)\s+(B|KiB|MiB|GiB)/);
            if (bytesMatch) {
              const rxValue = parseFloat(bytesMatch[1]);
              const rxUnit = bytesMatch[2];
              const txValue = parseFloat(bytesMatch[3]);
              const txUnit = bytesMatch[4];

              // 단위를 바이트로 변환
              const rxBytes = convertToBytes(rxValue, rxUnit);
              const txBytes = convertToBytes(txValue, txUnit);

              totalRx += rxBytes;
              totalTx += txBytes;
            }
          }

          return { rx: totalRx, tx: totalTx };

        } catch (error) {
          logger.debug('nettop failed, falling back to ifconfig:', error);

          // 방법 2: ifconfig 방식
          try {
            const ifaceList = await runMacCommand("ifconfig -l");
            const ifaces = ifaceList.split(/\s+/).filter(Boolean);
            let maxRx = 0, maxTx = 0;
            let found = false;

            for (const iface of ifaces) {
              try {
                const ifconfigOutput = await runMacCommand(`ifconfig ${iface}`);

                // macOS ifconfig 출력 형식에 맞는 다양한 패턴 시도
                let rx = 0, tx = 0;

                // 패턴 1: 'input bytes 123456789 output bytes 987654321'
                const rxMatch1 = ifconfigOutput.match(/input bytes (\d+)/);
                const txMatch1 = ifconfigOutput.match(/output bytes (\d+)/);

                // 패턴 2: 'bytes: 123456789 987654321' (일부 macOS 버전)
                const bytesMatch = ifconfigOutput.match(/bytes:\s*(\d+)\s+(\d+)/);

                // 패턴 3: 'RX packets:1234 errors:0 dropped:0 overruns:0 frame:0 TX packets:1234 errors:0 dropped:0 overruns:0 carrier:0 collisions:0 txqueuelen:1000 RX bytes:123456789 (117.7 MiB) TX bytes:987654321 (942.5 MiB)'
                const rxMatch3 = ifconfigOutput.match(/RX bytes:(\d+)/);
                const txMatch3 = ifconfigOutput.match(/TX bytes:(\d+)/);

                if (rxMatch1 && txMatch1) {
                  rx = parseInt(rxMatch1[1]);
                  tx = parseInt(txMatch1[1]);
                } else if (bytesMatch) {
                  rx = parseInt(bytesMatch[1]);
                  tx = parseInt(bytesMatch[2]);
                } else if (rxMatch3 && txMatch3) {
                  rx = parseInt(rxMatch3[1]);
                  tx = parseInt(txMatch3[1]);
                }

                if (rx > 0 || tx > 0) {
                  // 가장 큰 RX+TX를 가진 인터페이스 사용
                  if (rx + tx > maxRx + maxTx) {
                    maxRx = rx;
                    maxTx = tx;
                    found = true;
                  }
                }
              } catch (e) {
                logger.debug(`Error reading interface ${iface}:`, e);
              }
            }

            if (found) {
              return { rx: maxRx, tx: maxTx };
            } else {
              return { rx: 0, tx: 0 };
            }
          } catch (ifconfigError) {
            logger.debug('ifconfig fallback failed:', ifconfigError);
            return { rx: 0, tx: 0 };
          }
        }
      } else {
        // Linux: /proc/net/dev로 인터페이스별 통계 조회 (가장 정확)
        try {
          // 방법 1: /proc/net/dev 사용 (우선순위 1)
          const netstatOutput = await runCommand("cat /proc/net/dev | grep -E '^(eth|wlan|lo|en|wl|ens|eno|enp)' | tail -n +2");
          let totalRx = 0;
          let totalTx = 0;
          const lines = netstatOutput.split('\n').filter(line => line.trim());

          for (const line of lines) {
            const parts = line.split(/\s+/).filter(part => part.trim());
            if (parts.length >= 17) {
              const rx = parseInt(parts[1]) || 0; // rx_bytes
              const tx = parseInt(parts[9]) || 0; // tx_bytes
              totalRx += rx;
              totalTx += tx;
            }
          }

          if (totalRx > 0 || totalTx > 0) {
            return { rx: totalRx, tx: totalTx };
          } else {
            throw new Error('/proc/net/dev에서 유효한 데이터를 찾을 수 없습니다.');
          }
        } catch (error) {
          logger.debug('/proc/net/dev failed, trying netstat:', error);
          
          // 방법 2: netstat 명령어 사용 (우선순위 2)
          try {
            const netstatOutput = await runCommand("netstat -i | grep -E '^(eth|wlan|lo|en|wl|ens|eno|enp)' | tail -n +2");
            let totalRx = 0;
            let totalTx = 0;
            const lines = netstatOutput.split('\n').filter(line => line.trim());

            for (const line of lines) {
              const parts = line.split(/\s+/).filter(part => part.trim());
              if (parts.length >= 4) {
                const rx = parseInt(parts[3]) || 0; // RX packets
                const tx = parseInt(parts[7]) || 0; // TX packets
                // 패킷 수를 바이트로 추정 (평균 패킷 크기 1500바이트)
                totalRx += rx * 1500;
                totalTx += tx * 1500;
              }
            }

            if (totalRx > 0 || totalTx > 0) {
              return { rx: totalRx, tx: totalTx };
            } else {
              throw new Error('netstat에서 유효한 데이터를 찾을 수 없습니다.');
            }
          } catch (netstatError) {
            logger.debug('netstat fallback failed:', netstatError);
            
            // 방법 3: ss 명령어 사용 (우선순위 3)
            try {
              const ssOutput = await runCommand("ss -i | grep -c ESTAB");
              const connections = parseInt(ssOutput.trim()) || 0;
              
              // 연결 수를 기반으로 네트워크 활동 추정
              const estimatedBytes = connections * 1024; // 연결당 1KB 추정
              return { rx: estimatedBytes, tx: estimatedBytes };
            } catch (ssError) {
              logger.debug('ss fallback failed:', ssError);
              
              // 방법 4: /proc/net/sockstat 사용 (우선순위 4)
              try {
                const sockstatOutput = await runCommand("cat /proc/net/sockstat | grep TCP");
                const match = sockstatOutput.match(/TCP:\s+(\d+)/);
                
                if (match) {
                  const tcpSockets = parseInt(match[1]) || 0;
                  const estimatedBytes = tcpSockets * 512; // 소켓당 512B 추정
                  return { rx: estimatedBytes, tx: estimatedBytes };
                } else {
                  throw new Error('/proc/net/sockstat에서 TCP 정보를 찾을 수 없습니다.');
                }
              } catch (sockstatError) {
                logger.debug('/proc/net/sockstat fallback failed:', sockstatError);
                return { rx: 0, tx: 0 };
              }
            }
          }
        }
      }
    };

    // 네트워크 속도 측정 (1초 간격으로 2번 측정)
    // 시스템 전체
    const systemStats1 = await getNetworkStats();
    // 프로세스별
    const processStats1 = await getProcessNetworkStats();

    // 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 두 번째 측정
    const systemStats2 = await getNetworkStats();
    const processStats2 = await getProcessNetworkStats();

    // 시스템 속도 계산
    const systemRxRate = Math.max(0, systemStats2.rx - systemStats1.rx);
    const systemTxRate = Math.max(0, systemStats2.tx - systemStats1.tx);

    // 프로세스 속도 계산
    const processRxRate = Math.max(0, processStats2.rx - processStats1.rx);
    const processTxRate = Math.max(0, processStats2.tx - processStats1.tx);

    const connections = parseInt(connectionsOutput) || 0;
    const result = {
      rxRate: formatBytesPerSec(systemRxRate),
      txRate: formatBytesPerSec(systemTxRate),
      processRxRate: formatBytesPerSec(processRxRate),
      processTxRate: formatBytesPerSec(processTxRate),
      connections,
      processConnections: processConnectionsCount
    };

    return result;
  } catch (error) {
    logger.error('Network info fetch error:', error);
    throw error;
  }
} 