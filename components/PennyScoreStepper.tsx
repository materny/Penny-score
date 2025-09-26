import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Info, TrendingUp, Wallet, Shield, House, PiggyBank, CreditCard, BarChart3 } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer
} from "recharts";

// --- Types

type JobType = "fastansat"|"tidsbegrænset"|"selvstændig"|"dagpenge"|"studerende";

type Inputs = {
  // Income & stability
  incomeSources: number;
  jobType: JobType;
  tenureMonths: number;
  netIncome12m: number;
  netIncome3m: number;
  netIncome9m: number;
  incomeStdDev: number;
  // Fixed costs & cashflow
  fixedCostAvg12m: number;
  fixedCostMedian12m: number;
  negativeMonths12m: number;
  surplusMonths12m: number;
  surplusMonths3m: number;
  // Short-term debt
  shortDebtCardsCount: number;
  shortDebtBalance: number;
  shortDebtAvgRatePct: number;
  // Long-term debt & housing
  houseValue: number;
  carValue: number;
  houseLoan: number;
  carLoan: number;
  mortgageFixedType: 0|1; // 1=fixed
  mortgageRatePct: number;
  interestOnlyYearsUsed: number;
  // Savings
  emergencyBufferKr: number;
  savingsRatePct: number;
  // Pension
  pensionRatePct: number;
  pensionWealthIndex: number;
  // Insurance
  hasIndbo: boolean;
  hasUlykke: boolean;
  hasKritisk: boolean;
  hasErhvervsevne: boolean;
  hasLiv: boolean;
  // Behaviour
  overdraftsLTM: number;
  subsPctIncome: number;
};

type PartScore = { key: string; label: string; score: number; max: number; area: number };

// --- Helpers
const clamp = (x:number, min:number, max:number) => Math.max(min, Math.min(max, x));

// --- Scoring engine (simplificeret og realistisk)
function scoreAll(i: Inputs){
  // 1. INDKOMST vs UDGIFTER (200 points)
  const IUR = i.netIncome12m/Math.max(i.fixedCostAvg12m,1);
  // IUR fra 1.0 til 1.5: 1.0 = 0%, 1.5 = 100%, men med bedre kurve
  // Ved IUR=1.21 skal vi have ~40-45% = ca. 63-68 point
  const iurScore = Math.min(1, Math.pow((IUR - 1.0) / 0.5, 0.7)); // Mindre hård kurve
  const s1 = 150 * iurScore; 
  
  const jobPts = i.jobType==="fastansat"?50: i.jobType==="tidsbegrænset"?35: i.jobType==="selvstændig"?25: i.jobType==="dagpenge"?10: 25;
  const s1b = jobPts;

  // 2. GÆLD (150 points) 
  const annualIncome = Math.max(i.netIncome12m * 12, 1);
  const debtRatio = i.shortDebtBalance / annualIncome;
  const s2 = 150 * clamp(1 - debtRatio/0.3, 0, 1); // Maks 30% (mere realistisk)

  // 3. OPSPARING (200 points)  
  // 3A: Nødopsparing - 3 måneder = godt, 6+ = perfekt
  const emergencyMonths = i.emergencyBufferKr / Math.max(i.fixedCostAvg12m, 1);
  const s3a = 100 * clamp(emergencyMonths / 3, 0, 1); // Op til 3 måneders udgifter
  
  // 3B: Opsparingsrate - 10% = godt
  const s3b = 100 * clamp((i.savingsRatePct / 100) / 0.10, 0, 1); // Op til 10%

  // 4. BOLIG (100 points) - mere generøs
  let s4 = 60; // Bedre default
  if (i.houseValue > 0 && i.houseLoan > 0) {
    const ltv = i.houseLoan / i.houseValue;
    s4 = ltv < 0.50 ? 100 : ltv < 0.70 ? 85 : ltv < 0.85 ? 70 : ltv < 0.95 ? 50 : 25;
  } else if (i.houseValue > 0 && i.houseLoan === 0) {
    s4 = 100; // Ejer uden gæld
  }

  // 5. FORSIKRING (100 points)
  const insuranceCount = (i.hasIndbo ? 1 : 0) + (i.hasUlykke ? 1 : 0) + (i.hasLiv ? 1 : 0);
  const s5 = (100 / 3) * insuranceCount;

  const parts: PartScore[] = [
    {key:'1A',label:'Indkomst vs faste udgifter',score:s1,max:150,area:1},
    {key:'1B',label:'Jobstabilitet',score:s1b,max:50,area:1},
    {key:'2A',label:'Gæld i forhold til indkomst',score:s2,max:150,area:2},
    {key:'3A',label:'Nødopsparing',score:s3a,max:100,area:3},
    {key:'3B',label:'Månedlig opsparingsrate',score:s3b,max:100,area:3},
    {key:'4A',label:'Boliggæld (hvis relevant)',score:s4,max:100,area:4},
    {key:'5A',label:'Forsikringsdækning',score:s5,max:100,area:5},
  ];

  const total = parts.reduce((s,p)=>s+p.score,0);
  const max = parts.reduce((s,p)=>s+p.max,0);
  return { total, max, percent:(total/max)*100, parts };
}

// --- Smart Tips System
const tipDatabase = {
  1: { // Indkomst & job
    icon: "💰",
    title: "Indkomst & Job",
    tips: [
      { text: "Bed om lønforhøjelse - selv 2.000 kr mere/md giver +10-15 point", boost: "10-15p" },
      { text: "Få fastansættelse hvis du er vikar - giver automatisk +15 point", boost: "+15p" },
      { text: "Tag et bijob 1 dag om ugen - 5.000 kr ekstra/md = +8-12 point", boost: "+8-12p" },
      { text: "Optimer dine fradrag - få mere udbetalt efter skat", boost: "+5-8p" },
      { text: "Skift til højere lønnet job - 5.000 kr mere giver stor forskel", boost: "+12-18p" },
      { text: "Bliv konsulent/freelancer - ofte højere timeløn", boost: "+8-15p" },
      { text: "Få overtidstillæg eller weekendtillæg på dit job", boost: "+6-10p" },
      { text: "Tag et kursus der kan øge din løn - investering der betaler sig", boost: "+10-20p" },
      { text: "Få bil- eller telefon-goder - reducer dine udgifter", boost: "+5-8p" },
      { text: "Forhandl bonusordning eller resultatløn på dit job", boost: "+8-12p" },
      { text: "Sælg ting du ikke bruger - iPad, cykler, tøj på DBA", boost: "+3-6p" },
      { text: "Start en lille side-hustle - webshop, tutoring, rengøring", boost: "+5-12p" },
      { text: "Få pension/sundhedsforsikring via jobbet - sparer penge", boost: "+4-7p" },
      { text: "Bliv formand i fagforening - ofte lønkompensation", boost: "+3-5p" },
      { text: "Tag natarbejde eller skifthold - højere løn", boost: "+8-12p" }
    ]
  },
  2: { // Gæld
    icon: "💳", 
    title: "Gæld",
    tips: [
      { text: "Sammel al gæld i ét lån med lav rente - spar 2-5% i rente", boost: "+20-30p" },
      { text: "Indfri dit kreditkort helt - eliminér 15-25% rente med det samme", boost: "+25-40p" },
      { text: "Forhandl lavere rente på dit banklån - ring i dag!", boost: "+15-25p" },
      { text: "Betal 2.000 kr ekstra om måneden - du er gældfri 2-3 år hurtigere", boost: "+10-15p" },
      { text: "Lån af familie/venner til 0% rente i stedet for banken", boost: "+20-35p" },
      { text: "Sælg noget stort (bil, båd, motorcykel) og betal gæld af", boost: "+30-50p" },
      { text: "Stop med at købe på kredit - betal kontant fremover", boost: "+15-20p" },
      { text: "Flyt gæld til bank med bedre rente - sammenlign online", boost: "+10-20p" },
      { text: "Brug skattetilbagebetaling/feriepenge til at nedbringe gæld", boost: "+20-25p" },
      { text: "Forhandl afdragsfrihed midlertidigt for at få råd til større afbetaling", boost: "+8-12p" },
      { text: "Tag et quicklån kun hvis du kan betale det tilbage på under 30 dage", boost: "+5-8p" },
      { text: "Undgå dyre forbrugslån - vær kreativ med finansiering", boost: "+15-25p" },
      { text: "Lav en gældssnebold-plan - betal mindste afdrag til alle småt gæld af først", boost: "+12-18p" },
      { text: "Brug bonusser og lønstigninger 100% til gældsafbetaling", boost: "+10-15p" },
      { text: "Skift kreditkort til et med 0% rente de første 12 måneder", boost: "+8-12p" }
    ]
  },
  3: { // Opsparing
    icon: "🐷",
    title: "Opsparing", 
    tips: [
      { text: "Automatiser din opsparing - 2.000 kr/md går direkte til opsparing", boost: "+15-25p" },
      { text: "Opret nødopsparing på 50.000 kr - det giver store point med det samme", boost: "+30-40p" },
      { text: "Brug 50/30/20 reglen - 20% af indkomst til opsparing", boost: "+20-30p" },
      { text: "Spar alle mønter og 50-kr sedler op i en krukke", boost: "+3-5p" },
      { text: "Sælg ting på DBA og læg pengene direkte i opsparing", boost: "+5-10p" },
      { text: "Brug højrentekonto til din buffer - få renter mens du sparer", boost: "+2-4p" },
      { text: "Spar dine feriepenge i stedet for at bruge dem", boost: "+8-12p" },
      { text: "Lav en 'spar først'-regel - spar inden du betaler regninger", boost: "+15-20p" },
      { text: "Rund op alle køb til nærmeste 10-kr og spar forskellen", boost: "+5-8p" },
      { text: "Lav madpakke i stedet for at købe frokost - spar 100-150 kr/dag", boost: "+12-18p" },
      { text: "Hold en no-spend weekend hver måned - spar alt du ellers ville bruge", boost: "+6-10p" },
      { text: "Få cash-back på alle køb og læg det direkte i opsparing", boost: "+3-6p" },
      { text: "Spar hele din skattetilbagebetaling - det er 'gratis' penge", boost: "+10-15p" },
      { text: "Udfordring: Spar 100 kr mere hver uge - det bliver til 5.200 kr/år", boost: "+8-12p" },
      { text: "Invester i index-fonde - lad dine penge arbejde for dig", boost: "+10-20p" }
    ]
  },
  4: { // Bolig
    icon: "🏡",
    title: "Bolig",
    tips: [
      { text: "Få din bolig vurderet - den er måske steget 200-500k i værdi", boost: "+10-20p" },
      { text: "Ekstraafbetal 2.000 kr/md på dit lån - spar 100.000+ kr i rente", boost: "+15-25p" },
      { text: "Forhandl lavere rente med banken - selv 0,2% sparer tusindvis", boost: "+20-30p" },
      { text: "Overvej at refinansiere hvis renten er faldet", boost: "+15-25p" },
      { text: "Udlej et værelse - 4.000 kr/md skattefri lejeindtægt", boost: "+12-18p" },
      { text: "Renovér køkken/bad - øger boligens værdi med 100-300k", boost: "+8-15p" },
      { text: "Skift til fast rente hvis du har variabel - mere forudsigeligt", boost: "+5-10p" },
      { text: "Optag afdragsfrihed kortvarigt for at samle på udbetaling", boost: "+3-8p" },
      { text: "Få energimærket forbedret - sparer penge og øger værdi", boost: "+5-12p" },
      { text: "Lav gør-det-selv renoveringer - spar 50% på håndværker", boost: "+8-12p" },
      { text: "Få boligadvokat til at tjekke dit lån - der kan være fejl", boost: "+5-10p" },
      { text: "Kig på afdragsfrit lån ved refinansiering - lavere månedsydelse", boost: "+6-12p" },
      { text: "Udnyt ROT-fradrag ved renoveringer - få penge tilbage på skatten", boost: "+4-8p" },
      { text: "Overføre høj værdi til lavere LTV-ratio ved at nedbetale mere", boost: "+10-20p" },
      { text: "Bliv boligejer i stedet for lejer - byg kapital i stedet for 'tab'", boost: "+20-40p" }
    ]
  },
  5: { // Forsikring
    icon: "🛡️",
    title: "Forsikring",
    tips: [
      { text: "Få indboforsikring - koster kun 100-200 kr/md og giver +33 point", boost: "+33p" },
      { text: "Tilføj ulykkesforsikring - billig beskyttelse, stor pointgevinst", boost: "+33p" },
      { text: "Overvej livsforsikring hvis du har familie - vigtig økonomisk sikkerhed", boost: "+33p" },
      { text: "Saml alle forsikringer ét sted - få 10-20% rabat", boost: "+5-8p" },
      { text: "Tjek din selvrisiko - højere selvrisiko = lavere præmie", boost: "+3-6p" },
      { text: "Få erhvervsevne-forsikring via dit job - ofte billigere", boost: "+15-20p" },
      { text: "Forhøj dækningen på din indboforsikring - beskyt dig bedre", boost: "+2-5p" },
      { text: "Tilføj cykel/værdigenstande til din forsikring", boost: "+3-6p" },
      { text: "Byt til billigere forsikringsselskab - sammenlign priser årligt", boost: "+4-8p" },
      { text: "Få forsikring gennem A-kasse eller fagforening - ofte bedre priser", boost: "+5-10p" },
      { text: "Tilføj retshjælpsforsikring - hjælper ved juridiske problemer", boost: "+3-5p" },
      { text: "Få kritisk sygdom forsikring - vigtig beskyttelse", boost: "+8-12p" },
      { text: "Overvej husforsikring i stedet for indboforsikring hvis du ejer", boost: "+5-8p" },
      { text: "Få familieforsikring i stedet for individuelle - ofte billigere", boost: "+6-10p" },
      { text: "Sørg for at din forsikring følger med inflationen automatisk", boost: "+2-4p" }
    ]
  }
};

function getRandomTipForArea(area: number, _currentInputs: Inputs): {text: string, boost: string, icon: string, title: string} | null {
  const areaData = tipDatabase[area as keyof typeof tipDatabase];
  if (!areaData) return null;
  
  const randomTip = areaData.tips[Math.floor(Math.random() * areaData.tips.length)];
  return {
    text: randomTip.text,
    boost: randomTip.boost,
    icon: areaData.icon,
    title: areaData.title
  };
}

// --- UI helpers
const areaMeta: Record<number, {title:string, icon: React.ComponentType<Record<string, unknown>>}> = {
  1: { title: "Indkomst & job", icon: TrendingUp },
  2: { title: "Gæld", icon: CreditCard },
  3: { title: "Opsparing", icon: PiggyBank },
  4: { title: "Bolig", icon: House },
  5: { title: "Forsikring", icon: Shield },
};

const defaultInputs: Inputs = {
  // Bruger input - dem brugeren kan redigere
  netIncome12m: 35000, 
  jobType: "fastansat", 
  fixedCostAvg12m: 25000,
  shortDebtBalance: 0, // Antag ingen gæld som standard
  emergencyBufferKr: 75000,
  savingsRatePct: 10, // Lidt højere standard opsparingsrate
  houseValue: 3000000, houseLoan: 2200000,
  hasIndbo: true, hasUlykke: true, hasLiv: false, // Bedre forsikringsdækning
  
  // Optimerede default værdier for simplificeret form
  netIncome3m: 35000, netIncome9m: 35000,
  incomeSources: 2, // Antag lidt diversificering
  tenureMonths: 48, // Stabil ansættelse
  incomeStdDev: 500, // Lav volatilitet
  fixedCostMedian12m: 25000, 
  negativeMonths12m: 0, // Ingen negative måneder
  surplusMonths12m: 12, // Alle måneder positive
  surplusMonths3m: 3, // Seneste måneder også positive
  shortDebtCardsCount: 0, // Ingen kreditkort
  shortDebtAvgRatePct: 0, // Ingen rente da ingen gæld
  carValue: 0, carLoan: 0, // Ingen bil som standard
  mortgageFixedType: 1, // Fast rente
  mortgageRatePct: 3.0, // Rimelig rente
  interestOnlyYearsUsed: 0, // Ingen afdragsfrihed
  pensionRatePct: 12, // God pensionsopsparing
  pensionWealthIndex: 120, // Lidt over gennemsnit
  hasKritisk: false, hasErhvervsevne: true, // Erhvervsevne er vigtig
  overdraftsLTM: 0, // Ingen overtræk
  subsPctIncome: 5, // Lavere abonnementer
};

// --- Component
export default function PennyScoreStepper(){
  const [i, setI] = useState<Inputs>(defaultInputs);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const res = useMemo(()=>scoreAll(i), [i]);

  const steps = [
    {
      title: "Din økonomi - fortæl os om dig",
      fields: (
        <div className="space-y-6">
          {/* Indkomst sektion */}
          <div>
            <h3 className="text-lg font-semibold mb-4">💰 Din indkomst</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField label="Månedlig indkomst (efter skat)" 
                value={i.netIncome12m} 
                onChange={v => setI({...i, netIncome12m:v})} />
              <SelectField label="Din jobsituation" value={i.jobType} onValueChange={(v)=>setI({...i, jobType: v as JobType})}
                options={[
                  {label: "Fastansat", value: "fastansat"},
                  {label: "Tidsbegrænset kontrakt", value: "tidsbegrænset"},
                  {label: "Selvstændig", value: "selvstændig"},
                  {label: "På dagpenge", value: "dagpenge"},
                  {label: "Studerende", value: "studerende"}
                ]}/>
            </div>
          </div>

          {/* Udgifter sektion */}
          <div>
            <h3 className="text-lg font-semibold mb-4">🏠 Dine faste udgifter</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField label="Månedlige faste udgifter (husleje, el, forsikringer osv.)" value={i.fixedCostAvg12m} onChange={v=>setI({...i, fixedCostAvg12m:v})} />
              <NumberField label="Har du kreditkort- eller forbrugsgæld? (kr.)" value={i.shortDebtBalance} onChange={v=>setI({...i, shortDebtBalance:v})} />
            </div>
          </div>

          {/* Opsparing sektion */}
          <div>
            <h3 className="text-lg font-semibold mb-4">🐷 Din opsparing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField label="Nødopsparing / buffer (kr.)" value={i.emergencyBufferKr} onChange={v=>setI({...i, emergencyBufferKr:v})} />
              <NumberField label="Hvor meget sparer du op om måneden? (kr.)" 
                value={Math.round((i.savingsRatePct / 100) * i.netIncome12m)} 
                onChange={v => {
                  const percentage = Math.round((v / Math.max(i.netIncome12m, 1)) * 100);
                  setI({...i, savingsRatePct: percentage});
                }} />
            </div>
          </div>

          {/* Bolig sektion */}
          <div>
            <h3 className="text-lg font-semibold mb-4">🏡 Din bolig (hvis du ejer)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField label="Boligens værdi (ca. vurdering)" value={i.houseValue} onChange={v=>setI({...i, houseValue:v})} />
              <NumberField label="Restgæld på boliglån" value={i.houseLoan} onChange={v=>setI({...i, houseLoan:v})} />
            </div>
          </div>

          {/* Forsikringer */}
          <div>
            <h3 className="text-lg font-semibold mb-4">🛡️ Dine forsikringer</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ToggleField label="Indboforsikring" checked={i.hasIndbo} onChange={v=>setI({...i, hasIndbo:v})} />
              <ToggleField label="Ulykkesforsikring" checked={i.hasUlykke} onChange={v=>setI({...i, hasUlykke:v})} />
              <ToggleField label="Livsforsikring" checked={i.hasLiv} onChange={v=>setI({...i, hasLiv:v})} />
            </div>
          </div>
        </div>
      )
    }
  ];

  const areaData = useMemo(()=>{
    // aggregate per area to 0-100 for radar
    const areaSums: Record<number,{score:number,max:number}> = {};
    scoreAll(i).parts.forEach(p=>{
      if(!areaSums[p.area]) areaSums[p.area] = {score:0,max:0};
      areaSums[p.area].score += p.score; areaSums[p.area].max += p.max;
    });
    return Object.entries(areaSums).map(([a,{score,max}])=>({
      area: areaMeta[+a].title,
      value: Math.round((score/max)*100)
    }));
  },[i]);

  const improvements = useMemo(()=>{
    // Get top areas with lost points and relevant tips
    const areaSums: Record<number,{score:number,max:number,lost:number}> = {};
    scoreAll(i).parts.forEach(p=>{
      if(!areaSums[p.area]) areaSums[p.area] = {score:0,max:0,lost:0};
      areaSums[p.area].score += p.score; 
      areaSums[p.area].max += p.max;
      areaSums[p.area].lost += (p.max - p.score);
    });
    
    return Object.entries(areaSums)
      .map(([area, {score, max, lost}]) => ({
        area: Number(area),
        areaTitle: areaMeta[+area].title,
        lost: +lost.toFixed(1),
        percentage: Math.round((score/max)*100),
        tip: getRandomTipForArea(Number(area), i)
      }))
      .sort((a,b) => b.lost - a.lost)
      .slice(0,3);
  },[i]);

  // Beregn potentiel årlig besparelse baseret på brugerens situation
  const potentialSavings = useMemo(() => {
    const monthlyIncome = i.netIncome12m;
    const currentDebtInterest = (i.shortDebtBalance * 0.15) / 12; // 15% årlig rente
    const currentLTV = i.houseValue > 0 ? i.houseLoan / i.houseValue : 0;
    const emergencyDeficit = Math.max(0, (i.fixedCostAvg12m * 3) - i.emergencyBufferKr);
    
    // Estimerede årlige besparelser ved optimering
    const yearlyInterestSavings = currentDebtInterest * 12; // Spare renter på gæld
    const mortgageSavings = currentLTV > 0.7 ? (i.houseLoan * 0.005) : 0; // 0.5% lavere rente
    const emergencyOpportunityCost = emergencyDeficit * 0.05; // 5% afkast på manglende buffer
    const optimizedSavingsRate = Math.max(0, (monthlyIncome * 0.15) - (monthlyIncome * (i.savingsRatePct/100))) * 12;
    
    const totalPotential = yearlyInterestSavings + mortgageSavings + emergencyOpportunityCost + optimizedSavingsRate;
    return Math.round(totalPotential);
  }, [i]);

  return (
    <>
      {/* Premium Popup */}
      {showPremiumPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setShowPremiumPopup(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full mb-4">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                🚀 Personlig Opsparingsanalyse
              </h3>
              <p className="text-gray-600 text-sm">
                Din situation kan optimeres til at spare dig
              </p>
              <div className="text-3xl font-bold text-amber-600 my-4">
                {potentialSavings.toLocaleString()} kr./år
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">🎯 Vi hjælper dig med:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Personlig gæld-optimeringsplan</li>
                  <li>• Boliglån renteforhandling</li>
                  <li>• Automatisk opsparingsstrategier</li>
                  <li>• Forsikring og investeringsrådgivning</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">💰 Vores pris:</h4>
                <p className="text-blue-700 text-sm">
                  <strong>Kun 10% af det du sparer i alt.</strong><br />
                  Hvis du sparer {potentialSavings.toLocaleString()} kr., betaler du kun {Math.round(potentialSavings * 0.1).toLocaleString()} kr.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  ✅ Ingen gevinst = ingen betaling
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                onClick={() => setShowPremiumPopup(false)}
              >
                🚀 Start nu - få din analyse
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPremiumPopup(false)}
              >
                Senere
              </Button>
            </div>
          </div>
        </div>
      )}

    <div className="py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-full">
            <Sparkles className="h-6 w-6 text-primary"/>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Penny.ai</h1>
            <p className="text-sm text-muted-foreground">Økonomisk score</p>
          </div>
          <Badge variant="secondary">Demo</Badge>
        </div>
      </div>

      {/* Main content - kompakt og centreret layout */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Venstre: Form */}
          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Wallet className="h-5 w-5 text-primary"/>
                </div>
                <div>
                  <CardTitle className="text-xl">{steps[0].title}</CardTitle>
                  <p className="text-sm text-muted-foreground">Udfyld dine oplysninger nedenfor</p>
                </div>
              </div>
            </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={0}
                initial={{opacity:0, y:8}}
                animate={{opacity:1, y:0}}
                exit={{opacity:0, y:-8}}
                transition={{duration:0.2}}
              >
                {steps[0].fields}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 text-center">
              <Badge variant="secondary" className="px-4 py-2">
                Din score opdateres automatisk
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Right: Charts & Results - radar chart first */}
        <div className="space-y-6">
          {/* Radar Chart - moved to top */}
          <Card className="shadow-lg">
            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-lg">Din Økonomiske Profil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={areaData} outerRadius={100}>
                    <PolarGrid gridType="polygon" />
                    <PolarAngleAxis dataKey="area" tick={{fontSize:11}} className="text-muted-foreground" />
                    <PolarRadiusAxis angle={30} domain={[0,100]} tick={{fontSize:10}} tickCount={5} />
                    <Radar 
                      name="Score" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Score Summary - Speedometer */}
          <Card className="shadow-lg">
            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-lg">Din Penny Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                {/* Speedometer SVG - Større og mere dramatisk */}
                <div className="relative w-64 h-44 mx-auto mb-6">
                  <svg viewBox="0 0 240 160" className="w-full h-full">
                    {/* Red zone (0-33%) - Større bue */}
                    <path
                      d="M 30 140 A 90 90 0 0 1 90 35"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    
                    {/* Yellow zone (33-66%) */}
                    <path
                      d="M 90 35 A 90 90 0 0 1 150 35"
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    
                    {/* Green zone (66-100%) */}
                    <path
                      d="M 150 35 A 90 90 0 0 1 210 140"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    
                    {/* Score indicator needle - Længere og tykkere */}
                    <g transform={`rotate(${-90 + (res.percent * 1.8)} 120 125)`}>
                      <line
                        x1="120"
                        y1="125"
                        x2="120"
                        y2="45"
                        stroke="#1f2937"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="120"
                        cy="125"
                        r="8"
                        fill="#1f2937"
                      />
                    </g>

                    {/* Graduering markeringer */}
                    <g stroke="#6b7280" strokeWidth="2">
                      <line x1="30" y1="140" x2="25" y2="135" /> {/* 0% */}
                      <line x1="60" y1="60" x2="55" y2="55" />   {/* 25% */}
                      <line x1="120" y1="40" x2="120" y2="35" /> {/* 50% */}
                      <line x1="180" y1="60" x2="185" y2="55" /> {/* 75% */}
                      <line x1="210" y1="140" x2="215" y2="135" /> {/* 100% */}
                    </g>

                    {/* Tal på speedometer */}
                    <text x="25" y="155" textAnchor="middle" className="text-xs fill-gray-600 font-medium">0</text>
                    <text x="120" y="25" textAnchor="middle" className="text-xs fill-gray-600 font-medium">50</text>
                    <text x="215" y="155" textAnchor="middle" className="text-xs fill-gray-600 font-medium">100</text>
                  </svg>
                </div>
                
                {/* Score procent under speedometer */}
                <div className="text-center mb-4">
                  <span className="text-3xl font-bold text-gray-800">{res.percent.toFixed(0)}%</span>
                </div>
                
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-bold">{res.total.toFixed(1)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Max</div>
                    <div className="font-bold">{res.max}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Procent</div>
                    <div className="font-bold">{res.percent.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full width improvements section */}
      <div className="mt-8 max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Hvor kan du hente flest point?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Premium Opsparingsanalyse - FØRST for at fange opmærksomhed */}
            <div className="mb-6">
              <div 
                className="border-2 border-dashed border-amber-300 rounded-lg p-6 bg-gradient-to-br from-amber-50 to-yellow-50 cursor-pointer hover:border-amber-400 transition-colors"
                onClick={() => setShowPremiumPopup(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <BarChart3 className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-amber-800">
                        🚀 Personlig Opsparingsanalyse
                      </div>
                      <div className="text-sm text-amber-700">
                        Få præcis beregning af hvor meget du kan spare om året
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500 hover:bg-amber-600">
                      Premium
                    </Badge>
                    <div className="p-1 bg-amber-200 rounded">
                      <svg className="h-4 w-4 text-amber-700" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold text-amber-800">
                    ⚡ Op til {potentialSavings.toLocaleString()} kr. om året
                  </div>
                  <div className="text-sm text-amber-600 mt-1">
                    Baseret på din nuværende situation og score
                  </div>
                </div>
              </div>
            </div>

            {/* Gratis tips herunder */}
            <div className="border-t pt-4">
              <h4 className="text-base font-medium text-gray-700 mb-4">💡 Gratis tips baseret på dine manglende point:</h4>
            </div>

            {improvements.map((area, idx)=> (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{area.tip?.icon}</span>
                    <div>
                      <div className="font-semibold text-base">{area.areaTitle}</div>
                      <div className="text-sm text-muted-foreground">
                        {area.percentage}% af maksimum - du taber {area.lost.toFixed(0)} point
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-200">
                    -{area.lost.toFixed(0)}p
                  </Badge>
                </div>
                
                {area.tip && (
                  <Alert className="border-blue-200 bg-blue-50/30">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800 text-sm">
                      💡 Smart tip ({area.tip.boost})
                    </AlertTitle>
                    <AlertDescription className="text-blue-700 text-sm mt-1">
                      {area.tip.text}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="h-2 bg-muted rounded">
                  <div 
                    className="h-2 rounded bg-gradient-to-r from-red-400 to-red-600" 
                    style={{width: `${Math.min(100, (area.lost/50)*100)}%`}} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown tabs - centered and compact */}
      <div className="mt-12 max-w-4xl mx-auto">
        <Tabs defaultValue="areas" className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="areas" className="text-sm">Områder</TabsTrigger>
              <TabsTrigger value="sub" className="text-sm">Sub-områder</TabsTrigger>
            </TabsList>
          </div>
        <TabsContent value="areas" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(areaMeta).map(([id, meta])=>{
              const parts = scoreAll(i).parts.filter(p=>p.area===Number(id));
              const areaScore = parts.reduce((s,p)=>s+p.score,0);
              const areaMax = parts.reduce((s,p)=>s+p.max,0);
              const Icon = meta.icon;
              return (
                <Card key={id}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{meta.title}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground"/>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{areaScore.toFixed(0)} / {areaMax}</div>
                    <div className="mt-2">
                      <ResponsiveContainer width="100%" height={80}>
                        <BarChart data={[{name:"", v: areaScore, m: areaMax}]}> 
                          <XAxis dataKey="name" hide/>
                          <YAxis hide domain={[0, areaMax]} />
                          <Bar dataKey="v" fill="#7db7ff" radius={[6,6,6,6]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="sub" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scoreAll(i).parts.map((p)=> (
              <Card key={p.key}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{p.label}</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3">
                    <div className="text-2xl font-bold">{p.score.toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">/ {p.max}</div>
                  </div>
                  <div className="mt-2 w-full h-2 bg-muted rounded">
                    <div className="h-2 bg-primary rounded" style={{width:`${(p.score/p.max)*100}%`}}/>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      </div>
      </div>
    </div>
    </>
  );
}

// --- Small form primitives using shadcn/ui + Tailwind
function NumberField({label, value, onChange}:{label:string; value:number; onChange:(v:number)=>void}){
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" inputMode="decimal" value={value ?? ""} onChange={(e)=>onChange(parseFloat(e.target.value)||0)} />
    </div>
  );
}

function SelectField({label, value, onValueChange, options}:{label:string; value:string; onValueChange:(v:string)=>void; options:(string|{label:string,value:string})[]}){
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o,idx)=> typeof o === "string" ? (
            <SelectItem key={idx} value={o}>{o}</SelectItem>
          ) : (
            <SelectItem key={idx} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleField({label, checked, onChange}:{label:string; checked:boolean; onChange:(v:boolean)=>void}){
  return (
    <div className="flex items-center gap-2 py-2">
      <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e)=>onChange(e.target.checked)} />
      <Label className="cursor-pointer" onClick={()=>onChange(!checked)}>{label}</Label>
    </div>
  );
}
