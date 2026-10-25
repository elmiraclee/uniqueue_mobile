import { useCallback, useEffect, useState } from 'react';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
export type SchoolLevel = 'Elementary' | 'JHS' | 'SHS' | 'College';
export type GradeOption = { school_level: SchoolLevel; value: string; label: string; year_level: number | null; active: boolean };
export const SCHOOL_LEVELS: {label: string; value: SchoolLevel}[] = [
 {label:'Elementary',value:'Elementary'},{label:'Junior High School (JHS)',value:'JHS'},
 {label:'Senior High School (SHS)',value:'SHS'},{label:'College',value:'College'},
];
export function gradeChoices(rows: GradeOption[], school: SchoolLevel, current?: {school: SchoolLevel; value: string}) {
 const choices=rows.filter(r=>r.school_level===school&&(r.active||(current?.school===school&&r.value===current.value)));
 if(current?.school===school&&current.value&&!choices.some(r=>r.value===current.value))
  return [...choices,{school_level:school,value:current.value,label:current.value+' (current)',year_level:null,active:false}];
 return choices;
}
export function useGradeOptions() {
 const [grades,setGrades]=useState<GradeOption[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{setLoading(true);setError('');try{
  const data=await fetchJsonOrNull(API.getGradeOptions);
  if(!data?.success||!Array.isArray(data.grades))throw new Error('Grade choices could not load. Retry before saving.');
  setGrades(data.grades);
 }catch(e){setError(e instanceof Error?e.message:'Grade choices could not load.');}finally{setLoading(false)}},[]);
 useEffect(()=>{void reload()},[reload]);
 return {grades,loading,error,reload};
}
