import moment from 'moment-timezone'
import CryptoJS from "crypto-js";
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_CRYPTO_ENCRYPTION_KEY || "default_secret_key";
const INDIA_TIMEZONE = 'Asia/Kolkata';


const helpers = {
  capitalizeFLetter: function capitalizeFLetter(string: any) {
    return string[0].toUpperCase() + string.slice(1)
  },

  covnertDateFormat: function covnertDateFormat(date: any) {
    return moment.tz(date, INDIA_TIMEZONE).format('DD-MM-YYYY')
  },

  convertMsToTime: (milliseconds: any) => {
    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    // 👇️ If you don't want to roll hours over, e.g. 24 to 00
    // 👇️ comment (or remove) the line below
    // commenting next line gets you `24:00:00` instead of `00:00:00`
    // or `36:15:31` instead of `12:15:31`, etc.
    hours = hours % 24;

    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(
      seconds,
    )}`;
  },

  convertMsToHHMM: (milliseconds: any) => {
    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    // 👇️ If you don't want to roll hours over, e.g. 24 to 00
    // 👇️ comment (or remove) the line below
    // commenting next line gets you `24:00:00` instead of `00:00:00`
    // or `36:15:31` instead of `12:15:31`, etc.
    hours = hours % 24;

    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}`;
  },

  formatTaskStatus: (status: String) => {
    if (!status) return "";
    const formattedStatus = status.replace("_", " ");
    return formattedStatus
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  },

  // Convert date to IST (India Standard Time) - previously was convertToUTC
  convertToIST: (date: any) => {
    if (!date) return null;
    const dateObj = moment.tz(date, INDIA_TIMEZONE);
    // Return date at start of day in IST
    return dateObj.startOf('day').toDate();
  },
  
  // Keep convertToUTC for backward compatibility but use IST
  convertToUTC: (date: any) => {
    if (!date) return null;
    // Convert to IST first, then return as Date object
    const dateObj = moment.tz(date, INDIA_TIMEZONE);
    return dateObj.startOf('day').toDate();
  },

  createLeaveDropDown: [
    { id: 'compensation', value: 'Compensation' },
    { id: 'apply', value: 'Apply Leave' },
  ],

  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ],

  convertHHMMAMPM: (TZdate: any) => {
    if (!TZdate) return '';
    return moment.tz(TZdate, INDIA_TIMEZONE).format('hh:mm A');
  },

  calcualteDuration: (startTime: any, endTime: any) => {
    if (!startTime || !endTime) return '0:00 hrs';
    const start = moment.tz(startTime, INDIA_TIMEZONE);
    const end = moment.tz(endTime, INDIA_TIMEZONE);
    const duration = moment.duration(end.diff(start));
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    return `${hours}:${minutes.toString().padStart(2, '0')} hrs`;
  },

  encryptData: (data: string): string => {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  },

  decryptData: (encryptedData: string): string => {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  },

  paySlipStaticData: [
    { PYMT_PROD_TYPE_CODE: 'PAB_VENDOR' },
    { PYMT_MODE: 'NEFT' },
    { DEBIT_ACC_NO: 341705000436 },

  ],

  bankOptions: [
    { value: "state_bank_of_india", label: "State Bank of India" },
    { value: "hdfc_bank", label: "HDFC Bank" },
    { value: "icici_bank", label: "ICICI Bank" },
    { value: "axis_bank", label: "Axis Bank" },
    { value: "punjab_national_bank", label: "Punjab National Bank" },
    { value: "kotak_mahindra_bank", label: "Kotak Mahindra Bank" },
    { value: "bank_of_baroda", label: "Bank of Baroda" },
    { value: "canara_bank", label: "Canara Bank" },
    { value: "union_bank_of_india", label: "Union Bank of India" },
    { value: "indian_bank", label: "Indian Bank" },
    { value: "indusind_bank", label: "IndusInd Bank" },
    { value: "bank_of_india", label: "Bank of India" },
    { value: "idbi_bank", label: "IDBI Bank" },
    { value: "uco_bank", label: "UCO Bank" },
    { value: "central_bank_of_india", label: "Central Bank of India" },
    { value: "bank_of_maharashtra", label: "Bank of Maharashtra" },
    { value: "indian_overseas_bank", label: "Indian Overseas Bank" },
    { value: "yes_bank", label: "Yes Bank" },
    { value: "federal_bank", label: "Federal Bank" },
    { value: "south_indian_bank", label: "South Indian Bank" },
    { value: "rbl_bank", label: "RBL Bank" },
    { value: "karnataka_bank", label: "Karnataka Bank" },
    { value: "karur_vysya_bank", label: "Karur Vysya Bank" },
    { value: "tamilnad_mercantile_bank", label: "Tamilnad Mercantile Bank" },
    { value: "city_union_bank", label: "City Union Bank" },
    { value: "jammu_and_kashmir_bank", label: "Jammu and Kashmir Bank" },
    { value: "dhanlaxmi_bank", label: "Dhanlaxmi Bank" },
    { value: "au_small_finance_bank", label: "AU Small Finance Bank" },
    { value: "ujjivan_small_finance_bank", label: "Ujjivan Small Finance Bank" },
    { value: "equitas_small_finance_bank", label: "Equitas Small Finance Bank" },
    { value: "jana_small_finance_bank", label: "Jana Small Finance Bank" },
    { value: "esaf_small_finance_bank", label: "ESAF Small Finance Bank" },
    { value: "north_east_small_finance_bank", label: "North East Small Finance Bank" },
    { value: "suryoday_small_finance_bank", label: "Suryoday Small Finance Bank" },
    { value: "capital_small_finance_bank", label: "Capital Small Finance Bank" },
    { value: "fincare_small_finance_bank", label: "Fincare Small Finance Bank" },
    { value: "nsdl_payments_bank", label: "NSDL Payments Bank" },
    { value: "india_post_payments_bank", label: "India Post Payments Bank" },
    { value: "airtel_payments_bank", label: "Airtel Payments Bank" },
    { value: "paytm_payments_bank", label: "Paytm Payments Bank" },
    { value: "fino_payments_bank", label: "Fino Payments Bank" }
  ],

  formatMsToHHMM: (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  }

}

const padTo2Digits = (num: any) => {
  return num.toString().padStart(2, '0');
}

export default helpers