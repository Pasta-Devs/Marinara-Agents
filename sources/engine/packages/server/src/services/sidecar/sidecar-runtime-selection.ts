import type { SidecarRuntimePreference } from "@marinara-engine/shared";

export type GpuVendor = "nvidia" | "amd" | "intel";

export interface RuntimeCapabilities {
  platform: NodeJS.Platform;
  arch: string;
  gpuVendors: GpuVendor[];
  preferCuda: boolean;
  preferHip: boolean;
  preferRocm: boolean;
  preferSycl: boolean;
  preferVulkan: boolean;
  systemLlamaPath: string | null;
}

export function formatRuntimePreference(preference: SidecarRuntimePreference): string {
  switch (preference) {
    case "auto":
      return "automatic detection";
    case "nvidia":
      return "an NVIDIA-compatible runtime";
    case "amd":
      return "an AMD GPU runtime";
    case "intel":
      return "an Intel GPU runtime";
    case "vulkan":
      return "a Vulkan runtime";
    case "cpu":
      return "a CPU-only runtime";
    case "system":
      return "a system llama-server runtime";
    default:
      return preference;
  }
}

export function isCpuVariant(variant: string): boolean {
  return /cpu/i.test(variant);
}

function isLinuxNvidiaFallbackVariant(variant: string): boolean {
  return /^linux-x64-(vulkan|cpu)$/i.test(variant);
}

export function isVariantCompatibleWithPreference(variant: string, preference: SidecarRuntimePreference): boolean {
  if (preference === "auto") {
    return true;
  }

  if (preference === "system") {
    return /^system-/i.test(variant);
  }

  if (preference === "cpu") {
    return isCpuVariant(variant);
  }

  if (preference === "nvidia") {
    return /cuda/i.test(variant) || isLinuxNvidiaFallbackVariant(variant);
  }

  if (preference === "amd") {
    return /(hip|rocm|vulkan)/i.test(variant);
  }

  if (preference === "intel") {
    return /(sycl|vulkan)/i.test(variant);
  }

  if (preference === "vulkan") {
    return /vulkan/i.test(variant);
  }

  return false;
}

export function buildPreferredRuntimeVariants(
  capabilities: RuntimeCapabilities,
  preference: SidecarRuntimePreference,
): string[] {
  if (capabilities.platform === "android" && capabilities.arch === "arm64") {
    return preference === "auto" || preference === "cpu" ? ["android-arm64-cpu"] : [];
  }

  if (capabilities.platform === "darwin" && capabilities.arch === "arm64") {
    return preference === "auto" ? ["macos-arm64-metal"] : [];
  }

  if (capabilities.platform === "darwin" && capabilities.arch === "x64") {
    return preference === "auto" || preference === "cpu" ? ["macos-x64-cpu"] : [];
  }

  if (capabilities.platform === "win32" && capabilities.arch === "arm64") {
    return preference === "auto" || preference === "cpu" ? ["win-arm64-cpu"] : [];
  }

  if (capabilities.platform === "win32" && capabilities.arch === "x64") {
    if (preference === "nvidia") return ["win-x64-cuda"];
    if (preference === "amd") return ["win-x64-hip", "win-x64-vulkan"];
    if (preference === "intel") return ["win-x64-sycl", "win-x64-vulkan"];
    if (preference === "vulkan") return ["win-x64-vulkan"];
    if (preference === "cpu") return ["win-x64-cpu"];
    if (preference !== "auto") return [];

    const variants: string[] = [];
    if (capabilities.preferCuda) variants.push("win-x64-cuda");
    if (capabilities.preferHip) variants.push("win-x64-hip");
    if (capabilities.preferSycl) variants.push("win-x64-sycl");
    if (capabilities.preferVulkan) variants.push("win-x64-vulkan");
    variants.push("win-x64-cpu");
    return variants;
  }

  if (capabilities.platform === "linux" && capabilities.arch === "x64") {
    if (preference === "nvidia") {
      return ["linux-x64-cuda", ...(capabilities.preferVulkan ? ["linux-x64-vulkan"] : []), "linux-x64-cpu"];
    }
    if (preference === "amd") return ["linux-x64-rocm", "linux-x64-vulkan"];
    if (preference === "intel") return ["linux-x64-vulkan"];
    if (preference === "vulkan") return ["linux-x64-vulkan"];
    if (preference === "cpu") return ["linux-x64-cpu"];
    if (preference !== "auto") return [];

    const variants: string[] = [];
    if (capabilities.preferCuda) variants.push("linux-x64-cuda");
    if (capabilities.preferRocm) variants.push("linux-x64-rocm");
    if (capabilities.preferVulkan) variants.push("linux-x64-vulkan");
    variants.push("linux-x64-cpu");
    return variants;
  }

  if (capabilities.platform === "linux" && capabilities.arch === "arm64") {
    if (preference === "vulkan" || preference === "amd" || preference === "intel") {
      return ["linux-arm64-vulkan"];
    }
    if (preference === "cpu") {
      return ["linux-arm64-cpu"];
    }
    if (preference !== "auto") {
      return [];
    }

    return capabilities.preferVulkan ? ["linux-arm64-vulkan", "linux-arm64-cpu"] : ["linux-arm64-cpu"];
  }

  return [];
}
