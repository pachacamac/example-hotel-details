(function($, Mustache) {
	"use strict";

	var hotelData = {
		name: "Bellagio Las Vegas",
		address: "South Las Vegas Boulevard 3600, NV 89109, Las Vegas, USA",
		tyId: "674fa44c-1fbd-4275-aa72-a20f262372cd",
		imgUrl: "img/674fa44c-1fbd-4275-aa72-a20f262372cd.jpg"
	};

	var languageNames = {
		en: "English",
		de: "German",
		fr: "French",
		es: "Spanish",
		it: "Italian",
		pt: "Portuguese",
		nl: "Dutsch",
		ru: "Russian",
		pl: "Polish",
		zh: "Chinese",
		ja: "Japanese",
		th: "Thai",
		id: "Indonesian",
		ko: "Korean",
		ar: "Arabic",
		sv: "Swedish",
		no: "Norwegian",
		fi: "Finnish",
		he: "Hebrew"
	};

	/*
	When querying a JSON widget, always ask for the specific version you
	developed against. This guarantees that no schema-breaking changes will
	affect your code.
	*/
	var url = "http://api.trustyou.com/hotels/" + hotelData.tyId + "/meta_review.json?" + $.param({
		lang: "en",
		/*
		This is a demo API key, do not reuse it! Contact TrustYou to
		receive your own.
		*/
		key: "a06294d3-4d58-45c8-97a1-5c905922e03a",
		v: "5.25"
	});
	var reviewSummaryRequest = $.ajax({
		url: url,
		// Usage of JSONP is not required for server-side calls
		dataType: "jsonp"
	}).fail(function() {
		throw "API request failed!";
	});

	/*
	Call the social api
	*/
	var socialUrl = "http://api.trustyou.com/hotels/" + hotelData.tyId + "/social.json?" + $.param({
		page_size: 2, // we ask for the most recent two posts
		lang_list: ["en"]
	});
	var socialRequest = $.ajax({
		url: socialUrl,
		dataType: "jsonp"
	}).fail(function() {
		throw "Social API request failed!";
	});

	/**
	* Render the hotel title, address & rating.
	*/
	function renderHotelTitle(hotelData, reviewSummary) {
		var hotelTitlteTemplate = $("#tmpl-hotel-title").html();
		var templateData = {
			name: hotelData.name,
			address: hotelData.address,
			reviewsCount: reviewSummary["reviews_count"],
			trustScore: reviewSummary["summary"].score,
		};

		var hotelTitleRendered = Mustache.render(hotelTitlteTemplate, templateData);
		$("#hotel-title").append(hotelTitleRendered);
	}

	/**
	* Render the basic hotel info.
	*/
	function renderHotelInfo(hotelData, reviewSummary) {
		var hotelInfoTemplate = $("#tmpl-hotel-info").html();
		var templateData = {
			name: hotelData.name,
			address: hotelData.address,
			imgUrl: hotelData.imgUrl,
			reviewsCount: reviewSummary["reviews_count"],
			trustScore: reviewSummary["summary"].score,
			popularity: reviewSummary["summary"].popularity,
			summary: reviewSummary["summary"].text
		};

		// transform hotel types to the format expected by the template
		templateData.hotelTypes = reviewSummary["hotel_type_list"].map(function(hotelType) {
			return {
				categoryId: hotelType["category_id"],
				/*
				Texts in the "text" property contain markers
				in the form of <pos>..</pos>, <neg>..</neg> and
				<neu>..</neu>, which enclose passages in the
				text that contain sentiment. Either remove
				these before displaying the text, or replace
				them with meaningful markup, as is done here.
				*/
				text: hotelType["text"].replace("<pos>", "<strong>").replace("</pos>", "</strong>")
			};
		});

		// transform hotel star distribution
		templateData.reviewsDistribution = reviewSummary["summary"]["reviews_distribution"]
		.reverse()
		.map(function(starBin) {
			return {
				reviewsCount: starBin["reviews_count"],
				stars: starBin["stars"],
				// we will color 4 & 5 green, 3 yellow, and 1 & 2 red
				sentiment: starBin["stars"] >= 4 ? "pos" : (starBin["stars"] <= 2 ? "neg" : "neu"),
				// divide the reviews count for this bin by the
				// total count to obtain a relative percentage
				percent: 100 * starBin["reviews_count"] / reviewSummary["reviews_count"]
			};
		});

		var hotelInfoRendered = Mustache.render(hotelInfoTemplate, templateData);
		$("#hotel-info").append(hotelInfoRendered);
	}

	/**
	* Prepare data from meta-review API to be displayed in the Mustache
	template. This method is called repeatedly, once for the overall meta-
	review, and once for each language-specific meta-review.
	*/
	function prepareTemplateData(reviewSummary) {
		var templateData = {};

		if (reviewSummary.hasOwnProperty("filter")) {
			/*
			This is a language-specific meta-review, i.e. only from
			reviews written in a certain language.
			*/
			templateData = {
				language: reviewSummary["filter"]["language"],
				label: languageNames[reviewSummary["filter"]["language"]],
				reviewsPercent: reviewSummary["reviews_percent"],
				travelerTypes: null,
				visibility: ""
			};
		} else {
			/*
			This is the overall meta-review, visible by default.
			*/
			templateData = {
				language: "all",
				label: "All languages",
				reviewsPercent: 100,
				travelerTypes: true,
				visibility: "in active"
			};
		}

		/*
		For this visualization, we will visualize the top 5 most
		frequent categories. For this, they are sorted by their "count"
		property.
		*/
		var categories = reviewSummary["category_list"].sort(function(catA, catB) {
			return catB["count"] - catA["count"];
		});
		/*
		Remove the overall sentiment category with ID "16" - these
		opinions are a bit too generic for this visualization.
		*/
		categories = categories.filter(function(category) {
			return category["category_id"] !== "16";
		});
		categories = categories.slice(0, 5);

		templateData.categories = categories.map(function(category, index) {
			return {
				// activate the first category in the list
				"class": index === 0 ? "in active" : "",
				categoryId: category["category_id"],
				categoryName: category["category_name"],
				sentiment: category["sentiment"],
				/*
				Show up to three returned highlights. If no
				highlights are present, the "short_text" is
				shown instead, which is guaranteed to be there
				for all category-language combinations.
				*/
				highlights: category["highlight_list"].concat({text: category["short_text"]}).slice(0, 3),
				/*
				Show category summary sentences.
				*/
				summarySentences: category["summary_sentence_list"].map(function(summarySentence) {
					return {
						sentiment: (summarySentence["sentiment"] == "neg" ? "remove" : "ok"),
						text: summarySentence["text"]
					};
				})
			};
		});

		/*
		Display the "good to know" categories in a separate section.
		*/
		templateData.goodToKnow = reviewSummary["good_to_know_list"].map(function(goodToKnow) {
			return {
				/*
				Show a positive icon for positive sentiment,
				negative otherwise.
				*/
				sentiment: goodToKnow["sentiment"] === "pos" ? "ok" : "remove",
				text: goodToKnow["short_text"]
			};
		});

		return templateData;
	}

	/**
	* Render the review summary.
	*/
	function renderReviewsTab(reviewSummary) {
		var reviewsTabTemplate = $("#tmpl-reviews-tab").html();

		// Transform the overall meta-review to the format expected
		// by the template ...
		var metaReviews = [prepareTemplateData(reviewSummary)]
		// ... append all language meta-reviews ...
		.concat(
			reviewSummary["language_meta_review_list"].map(prepareTemplateData)
		)
		// ... sort them by descending reviews count, and ...
		.sort(function(templateDataA, templateDataB) {
			return templateDataB.reviewsPercent - templateDataA.reviewsPercent;
		});
		// ... display them!

		var templateData = {
			languageMetaReviews: metaReviews
		};
		var reviewsTabRendered = Mustache.render(reviewsTabTemplate, templateData);
		$("#review-summary").append(reviewsTabRendered);

	}

	function renderLocationTab(hotelData) {
		var iframeUrl = "http://api.trustyou.com/hotels/" + hotelData.tyId  + "/location.html";
		$("#iframe-location").attr("src", iframeUrl);
	}

	/**
	 * Render the social tab.
	 */
	 function renderSocialTab(socialData) {
	 	var socialTabTemplate = $("#tmpl-social-tab").html();

        /**
         * Map the source url to css class
         */
         var getSourceIconClass = function(sourceID) {
         	if (sourceID === "google.com") { return "google-plus"; }
         	else {
         		var urlElems = sourceID.split(".");
         		return urlElems[urlElems.length-2];
         	}
         };

        /**
         * Format post date to month/date/year
         */
         var fromDateString = function(dateString) {
         	var parts = dateString.split("-");
         	var d = new Date(parts[0], parts[1]-1, parts[2]);
         	return [d.getMonth() + 1, d.getDate(), d.getFullYear()].join("/");
         };

         var templateData = {

            /**
             * For each social source, create a new section.
             */
             sources: socialData["source_list"].map(function(sourceData) {
             	var sourceIconClass = getSourceIconClass(sourceData.source_id);
             	return {
             		socialSource: sourceIconClass,

             		posts: sourceData["post_list"].filter(function(postData) {
                        /**
                         * We will only show google plus or foursquare posts here.
                         */
                         return (postData.source_id === "google.com" ||
                         	postData.source_id === "foursquare.com");
                     }).map(function(postData) {
                        /**
                         * Turn social posts into format for the template.
                         */
                         return {
                         	socialSourceClass: sourceIconClass,
                         	socialSource: postData.source_name,
                         	publishDate: fromDateString(postData.created),
                         	text: postData.text,
                            // show a source-specific default user name if
                            // author field is null
                            userName: postData.author
                            || ("A " + postData.source_name + " user")
                        };
                    })
                 };
             })
};

var socialRendered = Mustache.render(socialTabTemplate, templateData);
$("#social").append(socialRendered);
}

	/**
	Process a response from the TrustYou Review Summary API.
	*/
	function processReviewSummaryResponse(data) {
		// check whether the API request was successful
		if (data.meta.code !== 200) {
			throw "API request failed!";
		}
		var reviewSummary = data.response;
		renderHotelTitle(hotelData, reviewSummary);
		renderHotelInfo(hotelData, reviewSummary);
		renderReviewsTab(reviewSummary);
		renderLocationTab(hotelData);
	}

	function processSocialResponse(data) {
		if (data.meta.code !== 200) {
			throw "Social widget request failed!";
		}
		var socialData = data.response;
		renderSocialTab(socialData);
	}

	// when the DOM is ready for rendering, process the API response
	$(function() {
		reviewSummaryRequest.done(processReviewSummaryResponse);
		socialRequest.done(processSocialResponse);

		// if location tab is active reload the iframe first to make sure map is displayed
		$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
			if ($('.tab-content .tab-pane.active').attr('id') == 'location'){
				var iframe = $('#iframe-location')
				iframe.attr("src", iframe.attr("src"));
			}

		});

		// when a review language is selected within the reviews tab
		
		$(document).on('shown.bs.tab', '.traveler-language a[data-toggle="tab"]',function (e) {
			
			// remove active class from all dropdown languages
			$(this).parents('li').siblings().removeClass('active');
			
			// activate newly selected language
			$(this).parents('li').addClass('active');

			// update text for dropdown toggle
			$(this).parents('.dropdown').find('[data-toggle="dropdown"] .language-type').html($(this).find('.language-type').text());
			$(this).parents('.dropdown').find('[data-toggle="dropdown"] .value').html($(this).find('.value').text());
		
		});
	});

}($, Mustache));

$(document).ready(function(){
});
