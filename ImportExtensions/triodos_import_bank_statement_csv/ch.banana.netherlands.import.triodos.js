// Copyright [2026] [Banana.ch SA - Lugano Switzerland]
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @id = ch.banana.netherlands.import.triodos
// @api = 1.0
// @pubdate = 2026-02-18
// @publisher = Banana.ch SA
// @description = Triodos Bank - Import bank account statement (*.csv)
// @description.nl = Triodos Bank - Bankafschrift importeren (*.csv)
// @description.it = Triodos Bank - Importa movimenti estratto conto bancario (*.csv)
// @description.en = Triodos Bank - Import bank account statement (*.csv)
// @description.de = Triodos Bank - Kontoauszug importieren (*.csv)
// @description.fr = Triodos Bank - Importer un relevé de compte bancaire (*.csv)
// @doctype = *
// @docproperties =
// @task = import.transactions
// @outputformat = transactions.simple
// @inputdatasource = openfiledialog
// @inputencoding = latin1
// @inputfilefilter = Text files (*.txt *.csv);;All files (*.*)
// @inputfilefilter.de = Text (*.txt *.csv);;Alle Dateien (*.*)
// @inputfilefilter.fr = Texte (*.txt *.csv);;Tous (*.*)
// @inputfilefilter.it = Testo (*.txt *.csv);;Tutti i files (*.*)
// @timeout = -1
// @includejs = import.utilities.js

/**
 * Parse the data and return the data to be imported as a tab separated file.
 */
function exec(string, isTest) {

   var importUtilities = new ImportUtilities(Banana.document);

   if (isTest !== true && !importUtilities.verifyBananaAdvancedVersion())
      return "";

   var cleanString = string;
    if (cleanString.match(/""/)) {
        cleanString = cleanString.replace(/^"/g, "");
        cleanString = cleanString.replace(/"$/g, "");
        cleanString = cleanString.replace(/""/g, '');
    }

    var fieldSeparator = findSeparator(string);

   var transactions = Banana.Converter.csvToArray(string, fieldSeparator, '"');

   // Triodos Bank Format, this format works with the column positions.
   var triodosBankFormat1 = new TriodosBankFormat1();
   if (triodosBankFormat1.match(transactions)) {
      transactions = triodosBankFormat1.convert(transactions);
      return Banana.Converter.arrayToTsv(transactions);
   }

   // Format is unknow, return an error
   importUtilities.getUnknownFormatError();

   return "";
}

/**
 * Format 1: Triodos Bank Format, this format works with the column positions.
 **/
function TriodosBankFormat1() {

    // Index of columns in csv file	
	this.colDate     		= 0;
	this.colRef1    		= 1;
	this.colAmount			= 2; 
	this.colCreditDebit		= 3;
	this.colRef2   		    = 4;	
	this.colRef3           	= 5; 
    this.colRef4           	= 6; 
    this.colDescription     = 7;
    this.colBalance         = 8;

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

            Banana.console.log("Date: " + transaction[this.colDate] + " - Format Matched: " + formatMatched);

			if (formatMatched)
				return true;
		}

		return false;
	}

    /** Convert the transaction to the format to be imported */
    this.convert = function(transactions) {
        var transactionsToImport = [];

        /** Filter and map rows */
        for (var i = 0; i < transactions.length; i++) // First row contains the header
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
        var dateFormat = "dd-mm-yyyy";

        mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], dateFormat));
        mappedLine.push(""); // DateValue is missing
        mappedLine.push(""); // Doc is missing
        var tidyDescr = element[this.colRef2] + ' ' + element[this.colRef3] + ' ' + element[this.colDescription];
        tidyDescr = tidyDescr.replace(/ {2,}/g, ''); //remove white spaces
        mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
        if (element[this.colCreditDebit] === "Debet") {
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
 * The function cleanupText is used to remove useless text from input file, 
   in order to permit the conversion of data to table format.
 */
function cleanupText( string) {
	//remove tab
	string = string.replace(/\t/g, ' ');
	return string;
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
	
	if (tabCount > commaCount && tabCount > semicolonCount)
	{
		return '\t';
	}
	else if (semicolonCount > commaCount)
	{
		return ';';
	}

	return ',';
}


