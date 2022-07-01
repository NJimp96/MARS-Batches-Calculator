var inputs = {};

function download(filename, data){
    // compiles file into downloadable csv
    var csvRows = [];

    for(var i=0, l=data.length; i<l; ++i){
        csvRows.push(data[i].join(','));
    }

    var csvString = csvRows.join('\n');
    var a         = document.createElement('a');
    a.href        = 'data:attachment/csv,' +  encodeURIComponent(csvString);
    a.target      = '_blank';
    a.download    = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a)
}

function download_csv(){
    // downloads csv on form submission
    inputs['originalPhenolInletConc'] = Number(document.getElementById("phenolconc").value);
    inputs['originalPhenolInletVol'] = Number(document.getElementById("phenolvolume").value);
    inputs['desiredExtractionEfficiency'] = Number(document.getElementById("extracteff").value) / 100;
    inputs['naohWt'] = Number(document.getElementById("naohwt").value) / 100;
    inputs['hclWt'] = Number(document.getElementById("hclwt").value) / 100; 
    var data = main(inputs.originalPhenolInletConc, inputs.originalPhenolInletVol, inputs.desiredExtractionEfficiency, inputs.naohWt, inputs.hclWt);
    var filename = "marsBatches.csv";
    download(filename, data);
}

/*Assumptions for the following calculations:
1. The calculations will be run for 600 batches because the project brief specified it and thus energy balance calculations (not included here) have been made with a 12.5 hour batch time in mind
2. All solutions are dilute and thus have the density of water
3. During recovery all NaOH and HCl react to form NaCl*/

//Molar mass and solubility of relevant compounds
const phenolMM = 94.11
const naohMM = 39.997
const hclMM = 36.46
const naclMM = 58.44
const phenolWaterSol = 83
const phenolWaterSolMol = phenolWaterSol/phenolMM


function solubility(naclWt){
    // returns solubility (g/L) of phenol in the saline layer 
    let naclMC = naclWt * 1000/naclMM;
    let molarSolubility = phenolWaterSolMol/(Math.exp(0.3965*naclMC));
    let phenolSol = molarSolubility * phenolMM;
    return phenolSol
}

function rS(naclWt, saline, phenolRemoved){
    //returns the total amount of phenol in saline solution, amount of phenol in organic solution (wet phenol), total amount of recovery solution & total amount of organic solution
    let phenolSol = solubility(naclWt);
    let phenolSaline = phenolSol * saline;
    let phenolOrganic = phenolRemoved - phenolSaline;
    //phenol concentration in the organic phase approximately 80% based on literature(Han et al., 2001)
    let totalOrganic = phenolOrganic/0.8;
    let recoverySolution = totalOrganic + (saline * 1000)
    return [phenolSaline, phenolOrganic, recoverySolution, totalOrganic]
}

function batchCalculations(inletVol, inletConc, saline, naclWt, naohWt, hclWt){
    // returns an array of the phenol inlet concentration, amount of phenol removed, number of moles of phenol,
    // amount of naoh added, amount of hcl added, amount of saline solution and naclWt
    let phenolSol = solubility(naclWt);

    let phenolIn =  ((inletVol*(inletConc))+(saline* phenolSol))/(inletVol + saline);
    let phenolRemoved = (10+saline)*phenolIn-(20);
    let phenolMoles = phenolRemoved/phenolMM;
    let naohAdded = phenolMoles * naohMM/ naohWt;
    let hclAdded = phenolMoles * hclMM/ hclWt;
    let salineTons = (naohAdded + hclAdded)/1000;
    let naclWt2 = phenolMoles * naclMM / (salineTons * 1000);

    return [phenolIn, phenolRemoved, phenolMoles, naohAdded, hclAdded, salineTons, naclWt2]
}


function main(originalPhenolInletConc, originalPhenolInletVol, desiredExtractionEfficiency, naohWt, hclWt){
    let marsBatches = [['Iteration', 'Phenol Inlet Concentration (kg/m3)', 'FPR (kg)', 'Phenol Oultet Concentration (kg/m3)', '# of moles PhOH (mol)', 'NaOH added (kg)', 'HCl added (kg)', 'NaClwt', 'Saline (tons)', 'Solubility (g/L)', 'Total Recovery Solution (kg)',
                        'Phenol in Saline Solution (kg)', 'Phenol in Organic Phase (kg)','Total Organic Phase (kg)', 'Total Stripping Solution (kg)', 'Extraction Efficiency (%)', 'Recovery Efficiency (%)']]

    //calculate values for the first iteration
    var phenolRemoved = originalPhenolInletConc * originalPhenolInletVol * desiredExtractionEfficiency;
    var phenolOutletConc = 2;
    var phenolMoles = phenolRemoved / phenolMM;
    var naohPure = phenolMoles * naohMM;
    var naohAdded = naohPure / naohWt;
    var hclPure = phenolMoles * hclMM;
    var hclAdded = hclPure / hclWt;
    var naclFormed = phenolMoles * naclMM;
    var salineTons = (naohAdded + hclAdded)/1000;
    var naclWt = naclFormed/(salineTons * 1000);
    var phenolSol = solubility(naclWt);
    var phenolSaline = rS(naclWt, salineTons, phenolRemoved)[0];
    var phenolOrganic = rS(naclWt, salineTons, phenolRemoved)[1];
    var recoverySolution = rS(naclWt, salineTons, phenolRemoved)[2];
    var totalOrganic = rS(naclWt, salineTons, phenolRemoved)[3];
    var totalStrippingSol = phenolRemoved + naohAdded;
    var extractionefficiency = (phenolRemoved)/((originalPhenolInletVol+salineTons)*phenolInletConc);
    var recoveryefficiency = (phenolOrganic / phenolRemoved);
    var firstIteration = [1, originalPhenolInletConc, phenolRemoved, phenolOutletConc, phenolMoles, naohAdded, hclAdded, naclWt, salineTons, phenolSol, recoverySolution, phenolSaline, 
        phenolOrganic, totalOrganic, totalStrippingSol, extractionefficiency, recoveryefficiency];
    marsBatches.push(firstIteration)

    for (let i = 2; i <= 600; i++){
        // calculate values for 600 iterations
        var phenolInletConc = batchCalculations(originalPhenolInletVol, originalPhenolInletConc, salineTons, naclWt, naohWt, hclWt)[0];
        var phenolOutletConc = 20 / (salineTons + originalPhenolInletVol);
        var phenolRemoved = batchCalculations(originalPhenolInletVol, originalPhenolInletConc, salineTons, naclWt, naohWt, hclWt)[1];
        var phenolMoles = batchCalculations(originalPhenolInletVol, originalPhenolInletConc, salineTons, naclWt, naohWt, hclWt)[2];
        var naohAdded = batchCalculations(originalPhenolInletVol, originalPhenolInletConc, salineTons, naclWt, naohWt, hclWt)[3];
        var hclAdded = batchCalculations(originalPhenolInletVol, originalPhenolInletConc, salineTons, naclWt, naohWt, hclWt)[4];
        var salineTons = batchCalculations(originalPhenolInletVol, originalPhenolInletConc, salineTons, naclWt, naohWt, hclWt)[5];
        var naclWt = batchCalculations(originalPhenolInletVol, originalPhenolInletConc, salineTons, naclWt, naohWt, hclWt)[6];
        var phenolSol = solubility(naclWt);
        var phenolSaline = rS(naclWt, salineTons, phenolRemoved)[0];
        var phenolOrganic = rS(naclWt, salineTons, phenolRemoved)[1];
        var recoverySolution = rS(naclWt, salineTons, phenolRemoved)[2];
        var totalOrganic = rS(naclWt, salineTons, phenolRemoved)[3];
        var totalStrippingSol = phenolRemoved + naohAdded;
        var extractionefficiency = (phenolRemoved)/((originalPhenolInletVol+salineTons)*phenolInletConc) * 100;
        var recoveryefficiency = (phenolOrganic / phenolRemoved) * 100;
        var ithiteration = [i, phenolInletConc, phenolRemoved, phenolOutletConc, phenolMoles, naohAdded, hclAdded, naclWt, salineTons, phenolSol, recoverySolution, phenolSaline, 
            phenolOrganic, totalOrganic, totalStrippingSol, extractionefficiency, recoveryefficiency];
        marsBatches.push(ithiteration)
    }
    return marsBatches
}


