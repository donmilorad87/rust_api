export default class Helpers{

constructor(){
	
	 this.helpObject = {

            tabele: document.getElementById('kiki').getElementsByTagName('table')


        }
	
	
}

 pomocnikZaKvote(array, i) {
        for (let j = 0; j < 4; j++) {
            this.helpObject.tabele[i].getElementsByTagName('tr')[j].getElementsByTagName('td')[5].textContent = array[j]
        }
    }

    pomocnikPonocneFunkcije(array, i) {
        this.helpObject.tabele[i].getElementsByTagName('caption')[0].textContent = 'Kvota za ' + array[0] + ' || ' + array[1]

        this.helpObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[0].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[1].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[2].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]

        this.helpObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[1].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[2].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]

        this.helpObject.tabele[i].getElementsByTagName('tr')[2].getElementsByTagName('td')[2].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[2].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[2].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]

        this.helpObject.tabele[i].getElementsByTagName('tr')[3].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.helpObject.tabele[i].getElementsByTagName('tr')[3].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]
    }

}