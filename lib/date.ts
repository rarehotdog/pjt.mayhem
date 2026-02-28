export function getKSTDateString(date = new Date()) {
  const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const yyyy = kst.getFullYear();
  const mm = `${kst.getMonth() + 1}`.padStart(2, "0");
  const dd = `${kst.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
