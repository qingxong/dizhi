/** 将数字金额转为简体中文大写（元角分，无「整」时省略角分则为元整） */
export function amountToChineseUpper(amount: string): string {
  const n = Number(String(amount).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return String(amount);
  const digits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const units = ["", "拾", "佰", "仟"];
  const bigUnits = ["", "万", "亿"];
  const fixed = Math.round(n * 100);
  const intPart = Math.floor(fixed / 100);
  const dec = fixed % 100;
  const jiao = Math.floor(dec / 10);
  const fen = dec % 10;

  function sectionToCn(num: number): string {
    if (num === 0) return "";
    let s = "";
    const str = String(num);
    const len = str.length;
    let zero = false;
    for (let i = 0; i < len; i++) {
      const d = Number(str[i]);
      const pos = len - 1 - i;
      if (d === 0) {
        zero = true;
      } else {
        if (zero) s += "零";
        zero = false;
        s += digits[d] + units[pos % 4];
      }
      if (pos % 4 === 0 && pos > 0) {
        s += bigUnits[Math.floor(pos / 4)] || "";
      }
    }
    return s;
  }

  let result = "";
  if (intPart === 0) result = "零";
  else result = sectionToCn(intPart);
  result += "元";
  if (jiao === 0 && fen === 0) result += "整";
  else {
    if (jiao > 0) result += digits[jiao] + "角";
    else if (fen > 0) result += "零";
    if (fen > 0) result += digits[fen] + "分";
  }
  return result;
}
