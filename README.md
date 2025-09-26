# 🏆 Penny Score - Personlig Økonomisk Score

En moderne Next.js applikation der hjælper brugere med at vurdere og forbedre deres økonomiske sundhed gennem en intuitiv scoring algoritme.

## ✨ Features

- **📊 Intelligent Scoring System** - Beregner personlig økonomisk score baseret på 5 nøgleområder
- **🎯 Speedometer Visualization** - Flot speedometer der viser score fra 0-100% med farver
- **💡 Smart Tips System** - 75+ actionable tips der randomiseres baseret på brugerens situation  
- **🔒 Premium Analytics** - Locked feature der beregner potentiel årlig besparelse
- **📱 Responsive Design** - Fungerer perfekt på desktop og mobile
- **⚡ Real-time Updates** - Score opdateres øjeblikkeligt når brugeren ændrer tal

## 🔧 Tech Stack

- **Next.js 15.5.4** - React framework med Turbopack
- **TypeScript** - Type safety
- **Tailwind CSS 3.4.15** - Styling framework  
- **shadcn/ui** - Moderne UI komponenter
- **Recharts** - Data visualisering (RadarChart)
- **Framer Motion** - Smooth animationer

## 🚀 Scoring Områder

1. **💰 Indkomst & Job** (200 point) - Indkomst vs udgifter + jobstabilitet
2. **💳 Gæld** (150 point) - Gæld-ratio optimeret til max 30%
3. **🐷 Opsparing** (200 point) - Nødopsparing + månedlig opsparingsrate  
4. **🏡 Bolig** (100 point) - Loan-to-Value ratio på boliglån
5. **🛡️ Forsikring** (100 point) - Indboforsikring, ulykke, liv

**Total maksimum: 750 point**

## 🔒 Premium Feature

**Personlig Opsparingsanalyse** beregner potentiel årlig besparelse baseret på brugerens konkrete situation.
**Prismodel**: Kun 10% af det brugeren sparer - "Ingen gevinst = ingen betaling"

## 🎯 Installation

```bash
# Clone repository
git clone https://github.com/materny/Penny-score.git
cd Penny-score

# Install dependencies  
npm install

# Install shadcn/ui components
npx shadcn@latest add button card input label select progress tabs badge alert

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.
