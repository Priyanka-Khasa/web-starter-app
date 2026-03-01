import React, { createContext, useContext, useState, useCallback } from "react";

interface BluetoothContextType {
  heartRate: number | null;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const BluetoothContext = createContext<BluetoothContextType | null>(null);

export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<any>(null); // any because BluetoothDevice might not be typed

  const handleCharacteristicValueChanged = (event: any) => {
    const value = event.target.value; // DataView
    if (!value) return;
    
    // Parse Heart Rate Measurement characteristic
    // Format: Flags (1 byte), Heart Rate (1 or 2 bytes depending on flags)
    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    if (rate16Bits) {
      setHeartRate(value.getUint16(1, /*littleEndian=*/true));
    } else {
      setHeartRate(value.getUint8(1));
    }
  };

  const onDisconnected = useCallback(() => {
    setIsConnected(false);
    setHeartRate(null);
    setDevice(null);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      if (!(navigator as any).bluetooth) {
        throw new Error("Web Bluetooth API is not available in this browser. Please use Chrome/Edge in a secure context.");
      }

      const nav: any = navigator;
      const btDevice = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }]
      });

      btDevice.addEventListener('gattserverdisconnected', onDisconnected);
      setDevice(btDevice);

      const server = await btDevice.gatt?.connect();
      if (!server) throw new Error("Could not connect to GATT server.");

      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);

      setIsConnected(true);
    } catch (err: any) {
      console.error("Bluetooth connect error:", err);
      setError(err.message || String(err));
    }
  }, [onDisconnected]);

  const disconnect = useCallback(() => {
    try {
      if (device && device.gatt?.connected) {
        device.gatt.disconnect();
      }
    } catch (e) {
      console.error(e);
    }
    onDisconnected();
  }, [device, onDisconnected]);

  return (
    <BluetoothContext.Provider value={{ heartRate, isConnected, error, connect, disconnect }}>
      {children}
    </BluetoothContext.Provider>
  );
}

export function useBluetooth() {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error("useBluetooth must be used within a BluetoothProvider");
  }
  return context;
}
