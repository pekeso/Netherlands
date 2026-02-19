// @id = ch.banana.filter.import.ing
// @api = 1.0
// @pubdate = 2023-04-17
// @publisher = Banana.ch SA
// @description = ING Bank - Import bank account statement (*.csv)
// @doctype = *
// @docproperties =
// @task = import.transactions
// @outputformat = transactions.simple
// @inputdatasource = openfiledialog
// @inputencoding = latin1
// @includejs = import.utilities.js
// @inputfilefilter = Text files (*.txt *.csv);;All files (*.*)
// @inputfilefilter.de = Text (*.txt *.csv);;Alle Dateien (*.*)
// @inputfilefilter.fr = Texte (*.txt *.csv);;Tous (*.*)
// @inputfilefilter.it = Testo (*.txt *.csv);;Tutti i files (*.*)

/**
 * Parse the data and return the data to be imported as a tab separated file.
 */
function exec(inData, isTest) {

    if (!inData)
        return "";

    var importUtilities = new ImportUtilities(Banana.document);

    if (isTest !== true && !importUtilities.verifyBananaAdvancedVersion())
        return "";

    convertionParam = defineConversionParam(inData);
    //Add the header if present
    if (convertionParam.header) {
        inData = convertionParam.header + inData;
    }

    let transactions = Banana.Converter.csvToArray(inData, convertionParam.separator, convertionParam.textDelim);

    // Format 3
    var format3 = new IngFormat3();
    if (format3.match(transactions)) {
        transactions = format3.convert(transactions);
        return Banana.Converter.arrayToTsv(transactions);
    }
    // Format 2
    var format2 = new IngFormat2();
    if (format2.match(transactions)) {
        transactions = format2.convert(transactions);
        return Banana.Converter.arrayToTsv(transactions);
    }

    // Format 1
    var format1 = new IngFormat1();
    if (format1.match(transactions)) {
        transactions = format1.convert(transactions);
        return Banana.Converter.arrayToTsv(transactions);
    }

    importUtilities.getUnknownFormatError();

    return "";
}

/**
 * ING Format 3
 * "Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen";"Saldo na mutatie";"Tag"
 * "20230411";"Videre RiplasCrecem";"SK05NDRQ5381638231";"";"EX";"Eo";"3,37";"Postinos";"1 mrt t/m 31 mrt 2023 ING BANK N.V. Valutadatum: 11-04-2023";"66,15";""
 * "20230407";"H. Cor";"SK05NDRQ5381638231";"NY65PIMM4533828454";"ET";"Eo";"70,00";"Teribi morunaret";"Numn: H. Cor Vitrascentio: Niundita VERE: NY65PIMM4533828454 Raheturriem: 47-52-7637";"69,30";""
 * "20230403";"H. Cor";"SK05NDRQ5381638231";"NY65PIMM4533828454";"ET";"Eo";"70,00";"Teribi morunaret";"Numn: H. Cor Vitrascentio: Niundita VERE: NY65PIMM4533828454 Raheturriem: 42-52-7637";"139,30";""
 * "20230401";"Tuunt gent aucat albulo metincitino";"SK05NDRQ5381638231";"";"EX";"Eo";"8,65";"Postinos";"Posusta 26-42-7637 x/f 58-42-7637 86,12% (8,53% foratiam) nos cita Raheturriem: 26-52-7637";"209,30";""
 */
function IngFormat3() {
    this.colDate = 0;
    this.colDescr = 1;
    this.externalReference = 2;
    this.colCreditDebit = 5;
    this.colAmount = 6;
    this.colType = 7;
    this.colMessage = 8;
    this.balance = 9;
    this.colCount = 11;

    /** Return true if the transactions match this format */
    // Return true if the transactions match this format
	this.match = function (transactions) {
		
		if (transactions.length === 0)
			return false;

		for (var i = 0; i < transactions.length; i++) {
			var transaction = transactions[i];
			var formatMatched = true;
			
			if (formatMatched && transaction[this.colDate] && transaction[this.colDate].length >= 10 &&
				transaction[this.colDate].match(/^\d{2}-\d{2}-\d{4}$/))
				formatMatched = true;
			else
				formatMatched = false;

			if (formatMatched)
				return true;
		}

		return false;
	}

    /** Convert the transaction to the format to be imported */
    this.convert = function(transactions) {
        var transactionsToImport = [];

        /** Filter and map rows */
        for (var i = 1; i < transactions.length; i++) // First row contains the header
        {
            var transaction = transactions[i];
            if (transaction.length === 0) {
                continue; // Empty row
            } else {
                transactionsToImport.push(this.mapTransaction(transaction));
            }
        }

        // Sort rows by date (just invert)
        transactionsToImport = transactionsToImport.reverse();

        // Add header and return
        var header = [
            ["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]
        ];
        return header.concat(transactionsToImport);
    }

    /** Return true if the transaction is a transaction row */
    this.mapTransaction = function(element) {
        var mappedLine = [];

        var dateFormat = "";
        if (element[this.colDate].length === 8)
            dateFormat = "yyyymmdd";

        mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], dateFormat));
        mappedLine.push(""); // DateValue is missing
        mappedLine.push(""); // Doc is missing
        var tidyDescr = element[this.colType] + ' ' + element[this.colDescr];
        tidyDescr = tidyDescr.replace(/ {2,}/g, ''); //remove white spaces
        mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
        if (element[this.colCreditDebit] === "Af") {
            mappedLine.push("");
            mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colAmount], ","));
        } else {
            mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colAmount], ","));
            mappedLine.push("");
        }

        return mappedLine;
    }
}

/**
 * ING Format 2
 *
 * Nr v/d rekening :;979-9943918-65;Golden
 * Valutadatum;Ref. v/d verrichting;Beschrijving;Bedrag v/d verrichting;Munt;Datum v. verrichting;Rekening tegenpartij;Naam v/d tegenpartij :;Mededeling 1 :;Mededeling 2 :
 * 10-09-2010;B0I09NT0100000T9;Overschrijving in uw voordeel;239,01;EUR;10-09-2010;979-6330567-61;VAN OOTEGHEM - VAN DER MEU;2010/08 -  APP 1 L + GAR8;
 * 07-09-2010;B0I07ND00M0000P1;DomiciliÎring;-708,00;EUR;07-09-2010;409-0507801-50;     ORION PETROLEUM;AUTOMATISCHE DOMICILI  KLO1765;
 */
function IngFormat2() {
    this.colValuta = 0;
    this.colReference = 1;
    this.colDescription = 2;
    this.colAmount = 3;
    this.colCurrency = 4;
    this.colDate = 5;
    this.colMessage1 = 8;
    this.colMessage2 = 9;

    /** Return true if the transactions match this format */
    this.match = function(transactions) {
        if (transactions.length === 0)
            return false;
        if (transactions[1].length === (this.colMessage2 + 1))
            return true;
        return false;
    }

    /** Convert the transaction to the format to be imported */
    this.convert = function(transactions) {
        var transactionsToImport = [];

        /** Filter and map rows */
        for (var i = 1; i < transactions.length; i++) // First row contains the header
        {
            var transaction = transactions[i];

            if (transaction.length === 0) {
                continue; // Righe vuote
            } else if (transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length === 10 &&
                transaction[this.colValuta].match(/[0-9\.]+/g) && transaction[this.colValuta].length === 10) {
                transactionsToImport.push(this.mapTransaction(transaction));
            } else if (transaction[this.colDate].match(/[0-9]+/g) && transaction[this.colDate].length === 8 &&
                transaction[this.colValuta].match(/[0-9]+/g) && transaction[this.colValuta].length === 8) {
                transactionsToImport.push(this.mapTransaction(transaction));
            }
        }

        // Sort rows by date (just invert)
        transactionsToImport = transactionsToImport.reverse();

        // Add header and return
        var header = [
            ["Date", "DateValue", "Doc", "ExternalReference", "Description", "Income", "Expenses"]
        ];
        return header.concat(transactionsToImport);
    }

    /** Return true if the transaction is a transaction row */
    this.mapTransaction = function(element) {
        var mappedLine = [];

        var dateFormat = "";
        if (element[this.colDate].length === 8)
            dateFormat = "yyyymmdd";

        mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], dateFormat));
        mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colValuta], dateFormat));
        mappedLine.push(""); // Doc is empty for now
        mappedLine.push(element[this.colReference]);
        var tidyDescr = element[this.colDescription] + '; ' + element[this.colMessage1] + '; ' + element[this.colMessage2];
        tidyDescr = tidyDescr.replace(/ {2,}/g, ''); //remove white spaces
        mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));

        if (element[this.colAmount].length > 0) {
            if (element[this.colAmount].substring(0, 1) === '-') {
                mappedLine.push("");
                var amount;
                if (element[this.colAmount].length > 1)
                    amount = element[this.colAmount].substring(1);
                mappedLine.push(Banana.Converter.toInternalNumberFormat(amount, ","));
            } else {
                mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colAmount], ","));
                mappedLine.push("");
            }
        } else {
            mappedLine.push("");
            mappedLine.push("");
        }

        return mappedLine;
    }
}


/**
 * ING Format 1
 *
 * "Datum","Naam / Omschrijving","Rekening","Tegenrekening","Code","Af Bij","Bedrag (EUR)","MutatieSoort","Mededelingen"
 * "Data","Nome / Descrizione","Conto","Conto Contropartita","Codice","In meno  In pi˘","Importo","Genere di Trasazione","Comunicazioni"
 * "02-02-2009","KN: 7000000071630650","6040930","3779500","IC","Af","31,90","Incasso"," 1146279-200906                   30.09 EXCL./1.81 BTW             NIW KWARTAALABONNEMENT           Koninklijke BDU Uitgevers B.V."
 */
function IngFormat1() {
    this.colDate = 0;
    this.colDescr = 1;
    this.colDetail = 2;
    this.colCreditDebit = 5;
    this.colAmount = 6;
    this.colType = 7;
    this.colMessage = 8;

    /** Return true if the transactions match this format */
    this.match = function(transactions) {
        if (transactions.length === 0)
            return false;
        if (transactions[0].length === (this.colMessage + 1))
            return true;
        return false;
    }

    /** Convert the transaction to the format to be imported */
    this.convert = function(transactions) {
        var transactionsToImport = [];

        /** Filter and map rows */
        for (var i = 1; i < transactions.length; i++) // First row contains the header
        {
            var transaction = transactions[i];
            if (transaction.length === 0) {
                continue; // Empty row
            } else {
                transactionsToImport.push(this.mapTransaction(transaction));
            }
        }

        // Sort rows by date (just invert)
        transactionsToImport = transactionsToImport.reverse();

        // Add header and return
        var header = [
            ["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]
        ];
        return header.concat(transactionsToImport);
    }

    /** Return true if the transaction is a transaction row */
    this.mapTransaction = function(element) {
        var mappedLine = [];

        var dateFormat = "";
        if (element[this.colDate].length === 8)
            dateFormat = "yyyymmdd";

        mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], dateFormat));
        mappedLine.push(""); // DateValue is missing
        mappedLine.push(""); // Doc is missing
        var tidyDescr = element[this.colType] + ' ' + element[this.colDescr];
        tidyDescr = tidyDescr.replace(/ {2,}/g, ''); //remove white spaces
        mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
        if (element[this.colCreditDebit] === "Af") {
            mappedLine.push("");
            mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colAmount], ","));
        } else {
            mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colAmount], ","));
            mappedLine.push("");
        }

        return mappedLine;
    }
}

function defineConversionParam(inData) {
    var csvData = Banana.Converter.csvToArray(inData);
    var header = String(csvData[0]);
    var convertionParam = {};
    /** SPECIFY THE SEPARATOR AND THE TEXT DELIMITER USED IN THE CSV FILE */
    convertionParam.format = "csv"; // available formats are "csv", "html"
    //get text delimiter
    convertionParam.textDelim = '"';
    // get separator
    convertionParam.separator = findSeparator(inData);

    return convertionParam;
}

/**
 * The function findSeparator is used to find the field separator.
 */
function findSeparator( string) {

    var commaCount=0;
    var semicolonCount=0;
    var tabCount=0;

    for(var i = 0; i < 1000 && i < string.length; i++) {
        var c = string[i];
        if (c === ',')
            commaCount++;
        else if (c === ';')
            semicolonCount++;
        else if (c === '\t')
            tabCount++;
    }

    if (tabCount > commaCount && tabCount > semicolonCount) {
        return '\t';
    } else if (semicolonCount > commaCount)	{
        return ';';
    }

    return ',';
}