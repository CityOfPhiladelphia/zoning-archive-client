app = (function () {
    var $searchInput,
        $searchButton,
        $searchStatus,
        $resultsView,
        $docsTable;

    // The current doc result set.
    // TODO: don't do this.
    var curDocs;

    var docsRowTemplate = _.template('\
        <tr class="docs-row">\
          <td class="docs-row-scan-date"><%= scanDate %></td>\
          <td class="docs-row-doc-type"><%= docType %></td>\
          <td class="docs-row-num-pages"><%= numPages %></td>\
          <td class="docs-row-link">\
            <a class="popup" href="<%= url %>">View Document</a>\
          </td>\
        </tr>\
    ');

    var galleryItemTemplate = _.template('\
        <a href="<%= url %>" class="magnific-popup"><img src="<%= url %>"></a>\
    ');

    var imageUrlTemplate = _.template('http://www.phila.gov/zoningarchive/GenerateImage.aspx?app=<%= appId %>&docID=<%= appDocId %>&pageNum=<%= page %>');

    return {
        init: function ()
        {
            // Listen for routing events
            window.onpopstate = app.route;

            // Reference DOM elements
            $searchInput = $('#search-input');
            $searchButton = $('#search-button');
            $searchStatus = $('#search-status');
            $resultsView = $('#results-view');
            $docsTable = $('#docs-table');

            // Listen for keystrokes
            $searchInput.keyup(function (e) {
                if (e.keyCode == 13) {
                    $searchButton.click();
                }
            });

            // Listen for events
            $('#search-button').click(function (e) {
                var inputAddress = $searchInput.val();
                app.startSearch(inputAddress);
            });

            app.route();
        },

        route: function () {
            console.log('route: ' + window.location.hash);

            // parse url
            // render view
            var hash    = window.location.hash,
                parts   = hash.replace('#/', '').split('/'),
                view    = parts[0],
                param   = parts[1];

            switch (view) {
                case 'address':
                    var inputAddress = decodeURIComponent(param);
                    $searchInput.val(inputAddress);
                    $searchButton.click();
                    break;
                case 'document':
                    break;
                    app.renderDocument(param);
                default:
                    console.log('Unhandled view: ' + view)
            }
        },

        startSearch: function (inputAddress) {
            $searchStatus.html('Loading...').show();
            curDocs = undefined;

            // Standardize address
            $.ajax({
                url: 'http://api.phila.gov/ulrs/v3/addresses/' + inputAddress + '/',
                data: {f: 'json'},
                success: app.didStandardizeAddress,
                error: app.didFailToStandardizeAddress,
            });
        },

        didStandardizeAddress: function (data) {
            var stdAddress = data['addresses'][0]['standardizedAddress'];
            // $searchStatus.html('Finding documents...');

            $.ajax({
                url: 'https://c694a6d0.ngrok.io/address/' + stdAddress + '/documents/',
                success: app.didGetDocuments,
                error: app.didFailToGetDocuments,
            });
        },

        didFailToStandardizeAddress: function (data) {
            console.log(data);
            $searchStatus.html('Could not standardize address.');
        },

        imageUrlsForDocument: function (doc) {
            var numPages = doc.numPages,
                urls = [];
            for (var i = 1; i <= numPages; i++) {
                // Form image URL
                var url = imageUrlTemplate({
                    appDocId:   doc.appDocId,
                    appId:      doc.appId.length == 2 ? '0' + doc.appId : doc.appId,
                    page:       i,
                });
                urls.push(url);

                var items = urls.forEach(function (url) {
                    return {src: url};
                });
            }
            return urls;
        },

        didGetDocuments: function (data) {
            console.log(data);
            var docs = data.documents,
                address = data.inputAddress;
            // Reference these for the next view.
            curDocs = docs;
            // console.log(docs);

            $searchStatus.html(docs.length + ' results for ' + address + '.')
            $('.docs-row').remove()

            docs.forEach(function (doc) {
                // Form URL
                // var params = {
                //     numofPages: doc.numPages,
                //     docID: doc.docId,
                //     app: doc.appId,
                // };
                // var url = 'http://www.phila.gov/zoningarchive/Preview.aspx?' + $.param(params);
                
                // Clean up data
                var docRowParams = $.extend({}, doc);
                docRowParams.scanDate = docRowParams.scanDate || 'Unknown';
                docRowParams.url = '#/document/' + docRowParams.docId + '/';
                docRowParams.docType = app.util.toTitleCase(docRowParams.docType.replace(/S$/, ''));
                
                var newRowHtml = docsRowTemplate(docRowParams),
                    $newRow = $(newRowHtml);
                $docsTable.append($newRow);

                // Make gallery
                var ulrs = app.imageUrlsForDocument(doc),
                    items = _.map(ulrs, function (url) {
                        return {src: url, type: 'image', titleSrc: 'ABCD',};    
                    });
                // console.log(items);
                $link = $newRow.children().last().children('.popup');
                $link.magnificPopup({
                    gallery: {
                        enabled: true,
                        preload: [0, 0],
                    },
                    items: items,
                    callbacks: {
                        imageLoadComplete: function () {
                            var img = $('.mfp-img')[0],
                                aspectRatio = img.height / img.width;
                            if (aspectRatio === 1.2) {
                                var mfp = $.magnificPopup.instance;
                                var url = mfp.currItem.src;
                                mfp.content.replaceWith('<div style="color: #ddd">An error occurred loading this page.</div><div><a href="' + url + '" target="_blank">See the original here.</a>');
                                // console.log(mfp);
                                // console.log('trying again..');
                                // mfp.content.replaceWith('<img src="' + url + '">');
                                // mfp.updateItemHTML();

                                // $.ajax({
                                //     url: url,
                                //     success: function (data) {
                                //         console.log('got it');
                                //     },
                                //     error: function (data) {
                                //         console.log('error retrying...');
                                //     },
                                //     // async: false,
                                // });
                            }
                        },
                    },
                });
            });
            $resultsView.show()
            history.pushState(address, null, '#/address/' + encodeURIComponent(address) + '/');
        },

        didFailToGetDocuments: function (data) {
            $searchStatus.html('Could not find documents.');
        },

        renderResults: function (data) {

        },

        renderDocument: function (docId) {
            var doc = _.filter(curDocs, {docId: docId})[0];
                
                // Generate gallery item HTML
                // var html = galleryItemTemplate({url: url});
                // $gallery.append(html);
            
                // $('a.popup').each(function () {
                // $(this).magnificPopup({
                //     items: items,
                //     gallery: {enabled: true},
                // });
            

            // $('body').append($gallery);

            // Popupify
            // $gallery.magnificPopup({
            //     delegate: 'a',
            //     type: 'image',
            //     tLoading: 'Loading image...',
            //     mainClass: 'mfp-img-mobile',
            //     gallery: {
            //         enabled: true,
            //         navigateByImgClick: true,
            //         preload: [0,1] // Will preload 0 - before current, and 1 after the current image
            //     },
            //     image: {
            //         tError: '<a href="%url%">The image #%curr%</a> could not be loaded.',
            //         titleSrc: function(item) {
            //             return item.el.attr('title') + '<small>by Marsel Van Oosten</small>';
            //         }
            //     }
            // });

            // Attempt 2
            
         },

    };
}());

app.util = {
    toTitleCase: function (text) {
        return text.replace(/\w\S*/g, function (text) {
            return text.charAt(0).toUpperCase() + text.substr(1).toLowerCase();
        });
    },
}

app.init()