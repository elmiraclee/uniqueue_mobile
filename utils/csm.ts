export const CSM_QUESTIONS: Record<string,string>={"sqd0": "I am satisfied with the service that I availed.", "sqd1": "I spent an acceptable amount of time to complete my transaction (Responsiveness)", "sqd2": "The office accurately informed and followed the transaction’s requirements and steps (Reliability)", "sqd3": "I easily found information about my transaction from the office or its website (Communication)", "sqd4": "I paid no fees/an acceptable amount of fees for my transaction (Costs)", "sqd5": "I am confident my transaction was secure (Integrity)", "sqd6": "The office’s support was available, or (if asked questions) support was quick to respond (Assurance)", "sqd7": "I got what I needed from the University (Outcome)"};
export const CSM_REGIONS=[["NCR", "NCR (National Capital Region)"], ["CAR", "CAR (Cordillera Administrative Region)"], ["Region I", "Region I (Ilocos Region)"], ["Region II", "Region II (Cagayan Valley)"], ["Region III", "Region III (Central Luzon)"], ["Region IV-A", "Region IV-A (CALABARZON)"], ["MIMAROPA", "MIMAROPA Region"], ["Region V", "Region V (Bicol Region)"], ["Region VI", "Region VI (Western Visayas)"], ["NIR", "NIR (Negros Island Region)"], ["Region VII", "Region VII (Central Visayas)"], ["Region VIII", "Region VIII (Eastern Visayas)"], ["Region IX", "Region IX (Zamboanga Peninsula)"], ["Region X", "Region X (Northern Mindanao)"], ["Region XI", "Region XI (Davao Region)"], ["Region XII", "Region XII (SOCCSKSARGEN)"], ["Region XIII", "Region XIII (Caraga)"], ["BARMM", "BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)"], ["Outside Philippines", "Outside Philippines"]] as const;
export const CSM_SCALE=['Strongly Disagree','Disagree','Neither Agree or Disagree','Agree','Strongly Agree'];
export type CSMValues=Record<string,string|number>;
export function csmErrors(v:CSMValues):Record<string,string>{
 const e:Record<string,string>={};
 if(![0,1].includes(Number(v.data_sharing_consent))||v.data_sharing_consent==='')e.data_sharing_consent='Select Yes or No. No still permits submitting CSM.';
 if(!/^\d+$/.test(String(v.age))||Number(v.age)>120)e.age='Enter a whole age from 0 to 120.';
 if(!['Male','Female','Prefer not to say'].includes(String(v.sex)))e.sex='Choose sex.';
 if(!CSM_REGIONS.some(([key])=>key===v.region))e.region='Choose region.';
 if(!String(v.service_availed||'').trim())e.service_availed='Enter the service availed.';
 if(!['Employee','Faculty','Student','Alumni','Guest','Parent','Others'].includes(String(v.customer_type)))e.customer_type='Choose customer type.';
 if(v.customer_type==='Others'&&!String(v.customer_type_other||'').trim())e.customer_type_other='Specify customer type.';
 const cc1=Number(v.cc1),cc2=Number(v.cc2),cc3=Number(v.cc3);
 if(![1,2,3].includes(cc1))e.cc1='Answer CC1.';
 if([1,2].includes(cc1)&&![1,2,3].includes(cc2))e.cc2='Answer CC2.';
 if([1,2].includes(cc1)&&[1,2].includes(cc2)){
 if(![1,2].includes(cc3))e.cc3='Answer CC3.';
 if(cc3===2&&!String(v.cc3_reason||'').trim())e.cc3_reason='Enter why you could not use the Citizen’s Charter.';
 }
 for(const k of Object.keys(CSM_QUESTIONS))if(![1,2,3,4,5].includes(Number(v[k])))e[k]='Choose one rating from 1 to 5.';
 if(!['a','b'].includes(String(v.sqd8_variant))||![1,2,3,4,5].includes(Number(v.sqd8)))e.sqd8='Rate exactly one criterion: SQD8a or SQD8b.';
 for(const [k,max] of Object.entries({respondent_name:200,contact_number:40,service_availed:1000,customer_type_other:120,cc3_reason:1000,comment:2000}))if(String(v[k]||'').length>max)e[k]=`Use no more than ${max} characters.`;
 if(v.contact_number&&!/^\+?[0-9]{7,15}$/.test(String(v.contact_number).replace(/[ ()-]/g,'')))e.contact_number='Enter a valid 7–15 digit contact number.';
 return e;
}
export function normalizeCSM(v:CSMValues){const out={...v};if(Number(v.cc1)===3){out.cc2='';out.cc3='';out.cc3_reason='';}else if(Number(v.cc2)===3){out.cc3='';out.cc3_reason='';}else if(Number(v.cc3)!==2)out.cc3_reason='';if(v.customer_type!=='Others')out.customer_type_other='';return out;}
