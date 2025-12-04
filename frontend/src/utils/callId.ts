const CALL_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export const extractCallId = (rawValue: string): string | null => {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    const possibleKeys = ["startapp", "callId", "call_id", "id"];

    for (const key of possibleKeys) {
      const value = url.searchParams.get(key);
      if (value) {
        return value;
      }
    }

    const firstParamValue = url.searchParams.entries().next().value?.[1];
    if (firstParamValue) {
      return firstParamValue;
    }

    if (url.hash) {
      return url.hash.replace(/^#/, "");
    }

    return null;
  } catch (error) {
    // Not a URL — treat as a raw call ID
  }

  return trimmedValue;
};

export const isValidCallId = (callId: string): boolean => {
  return CALL_ID_PATTERN.test(callId);
};
