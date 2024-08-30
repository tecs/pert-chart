PERT.templates = Object.entries({
    NodeTemplate: `
        <div class="node">
            <input class="node-name" type="text" title="Name">
            <div class="node-drag" title="Drag"></div>
            <button class="node-critical" title="Toggle critical">&excl;</button>
            <button class="node-delete" title="Delete">&Cross;</button>
            <div class="node-edge" draggable="true" title="Connect">&Rarr;</div>
            <table class="node-resources"></table>
            <div class="node-dates">
                <input type="date" placeholder="YYYY-MM-DD" pattern="\d{4}(-\d{2}){2}" title="Start" />
                <input type="date" placeholder="YYYY-MM-DD" pattern="\d{4}(-\d{2}){2}" title="End" />
            </div>
        </div>
    `,
    ProjectTemplate: `
        <div>
            <button class="project-save">save</button>
            <button class="project-export">export</button>
            <button class="project-rename">rename</button>
            <button class="project-delete">delete</button>
            <button class="project-start">start</button>
            <br />
            <button class="project-add-node">add new milestone</button>
            <br /> <br />
            <div class="project-dates">
                <input type="date" placeholder="YYYY-MM-DD" pattern="\d{4}(-\d{2}){2}" title="Start" />
                <input type="date" placeholder="YYYY-MM-DD" pattern="\d{4}(-\d{2}){2}" title="End" />
            </div>
            <br />
            Timezone:

            <select class="project-timezone">
                <option value="-720">(GMT -12:00) Eniwetok, Kwajalein</option>
                <option value="-660">(GMT -11:00) Midway Island, Samoa</option>
                <option value="-600">(GMT -10:00) Hawaii</option>
                <option value="-570">(GMT -9:30) Taiohae</option>
                <option value="-540">(GMT -9:00) Alaska</option>
                <option value="-480">(GMT -8:00) Pacific Time (US &amp; Canada)</option>
                <option value="-420">(GMT -7:00) Mountain Time (US &amp; Canada)</option>
                <option value="-360">(GMT -6:00) Central Time (US &amp; Canada), Mexico City</option>
                <option value="-300">(GMT -5:00) Eastern Time (US &amp; Canada), Bogota, Lima</option>
                <option value="-270">(GMT -4:30) Caracas</option>
                <option value="-240">(GMT -4:00) Atlantic Time (Canada), Caracas, La Paz</option>
                <option value="-210">(GMT -3:30) Newfoundland</option>
                <option value="-180">(GMT -3:00) Brazil, Buenos Aires, Georgetown</option>
                <option value="-120">(GMT -2:00) Mid-Atlantic</option>
                <option value="-60">(GMT -1:00) Azores, Cape Verde Islands</option>
                <option value="0">(GMT +0:00) Western Europe Time, London, Lisbon, Casablanca</option>
                <option value="60">(GMT +1:00) Brussels, Copenhagen, Madrid, Paris</option>
                <option value="120">(GMT +2:00) Kaliningrad, South Africa</option>
                <option value="180">(GMT +3:00) Baghdad, Riyadh, Moscow, St. Petersburg</option>
                <option value="210">(GMT +3:30) Tehran</option>
                <option value="240">(GMT +4:00) Abu Dhabi, Muscat, Baku, Tbilisi</option>
                <option value="270">(GMT +4:30) Kabul</option>
                <option value="300">(GMT +5:00) Ekaterinburg, Islamabad, Karachi, Tashkent</option>
                <option value="330">(GMT +5:30) Bombay, Calcutta, Madras, New Delhi</option>
                <option value="345">(GMT +5:45) Kathmandu, Pokhara</option>
                <option value="360">(GMT +6:00) Almaty, Dhaka, Colombo</option>
                <option value="390">(GMT +6:30) Yangon, Mandalay</option>
                <option value="420">(GMT +7:00) Bangkok, Hanoi, Jakarta</option>
                <option value="480">(GMT +8:00) Beijing, Perth, Singapore, Hong Kong</option>
                <option value="525">(GMT +8:45) Eucla</option>
                <option value="540">(GMT +9:00) Tokyo, Seoul, Osaka, Sapporo, Yakutsk</option>
                <option value="570">(GMT +9:30) Adelaide, Darwin</option>
                <option value="600">(GMT +10:00) Eastern Australia, Guam, Vladivostok</option>
                <option value="630">(GMT +10:30) Lord Howe Island</option>
                <option value="660">(GMT +11:00) Magadan, Solomon Islands, New Caledonia</option>
                <option value="690">(GMT +11:30) Norfolk Island</option>
                <option value="720">(GMT +12:00) Auckland, Wellington, Fiji, Kamchatka</option>
                <option value="765">(GMT +12:45) Chatham Islands</option>
                <option value="780">(GMT +13:00) Apia, Nukualofa</option>
                <option value="840">(GMT +14:00) Line Islands, Tokelau</option>
            </select>
            <p>Resources:</p>
            <div class="project-resources"></div>
            <p>Stats:</p>
            <table class="project-stats"></table>
            <p>
                <button class="project-changes">requirement changes report</button>
            </p>
        </div>
    `,
    ResourceTemplate: `
        <div class="menu-contents-project-resource">
            <input type="text" name="name" placeholder="name" title="Name" />
            <input type="number" name="amount" min="0" placeholder="amount" title="Amount" />
            <input type="number" name="concurrency" min="0" placeholder="concurrency" title="Concurrency"/>
        </div>
    `,
    PopupTemplate: `
        <div class="popup">
            <div class="popup-background" title="Close popup"></div>
            <div class="popup-close">&Cross;</div>
            <div class="popup-content"></div>
        </div>
    `,
    ReportTemplate: `
        <div class="project-report">
            <h1 class="project-report-title"></h1>
            <h2>Project</h2>
            <p class="project-report-project"></p>
            <h2>Resources</h2>
            <p class="project-report-resources"></p>
            <h2>Milestones</h2>
            <p class="project-report-nodes"></p>
        </div>
    `,
}).reduce((map, [key, html]) => {
  const template = document.createElement('template');
  template.innerHTML = html;
  map[key] = template.content.firstElementChild;
  return map;
}, {});
