/** Legacy DB datetime values represent Asia/Manila. New offset-bearing API values pass through. */
export function serverDate(value:string):Date {
  const normalized=value.trim().replace(' ','T');
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)?normalized+'+08:00':normalized);
}
