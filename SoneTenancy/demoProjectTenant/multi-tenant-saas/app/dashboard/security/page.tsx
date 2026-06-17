﻿// import SecurityDashboard from "../../components/SecurityDashboard";

// export default function SecurityPage() {
//   return 
//   <SecurityDashboard />;
// }

import SecurityDashboard from '@/app/components/SecurityDashboard'
import React from 'react'
import S1Agent from './S1Agent/S1Agent'
import S1Cve from './S1CVE/S1Cve'
const SecurityPage = () => {
  return (
    <div>
      <SecurityDashboard />
      <S1Agent />
      <S1Cve />
    </div>
  )
}

export default SecurityPage
