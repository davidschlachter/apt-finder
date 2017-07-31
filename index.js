const moment = require('moment')
const scrape = require('./lib/scrape')
const mail = require('./lib/mail')
const db = require('./lib/db')
const _ = require('lodash')

const { BEDS, MAX_RENT } = process.env

const scraperConfig = [
  {
    url: `https://nooklyn.com/rentals?q=eyJhZGRyZXNzIjpudWxsLCJhZ2VudF9pZF9saXN0IjpudWxsLCJhbWVuaXR5X2xpc3QiOm51bGwsImFwYXJ0bWVudCI6bnVsbCwiZGF0ZV9hdmFpbGFibGUiOm51bGwsIm1pbl9iYXRocyI6bnVsbCwiYmVkX2xpc3QiOiIyIiwiYm90dG9tX3JpZ2h0X2xpc3QiOiIiLCJleGNsdXNpdmUiOmZhbHNlLCJmZWF0dXJlZCI6ZmFsc2UsImxpc3RpbmdfaWQiOm51bGwsIm1heF9wcmljZSI6MzAwMCwibWluX3ByaWNlIjpudWxsLCJtaW5fcHJpY2VfcGVyX2JlZCI6bnVsbCwibWF4X3ByaWNlX3Blcl9iZWQiOm51bGwsImxhdGl0dWRlIjpudWxsLCJsb25naXR1ZGUiOm51bGwsIm5laWdoYm9yaG9vZF9pZF9saXN0IjoiOCIsIm5vX2ZlZSI6ZmFsc2UsIm9yZGVyIjoicmVjZW50bHlfY3JlYXRlZCIsIm93bmVyX3BheXMiOmZhbHNlLCJwZXRzIjoiQW55IiwibWluX3NxdWFyZV9mZWV0IjpudWxsLCJtYXhfc3F1YXJlX2ZlZXQiOm51bGwsInN0YXR1c19saXN0IjoiQXZhaWxhYmxlIiwic3Vid2F5X2lkX2xpc3QiOiIiLCJ0b3BfbGVmdF9saXN0IjoiIiwidHlwZSI6InJlc2lkZW50aWFsIiwidHJhbnNhY3Rpb24iOiJyZW50YWxzIiwicmVnaW9uX2lkX2xpc3QiOm51bGwsInZhY2FudCI6ZmFsc2V9`,
    liSelector: '.nklyn-listing',
    link: $li => $li.find('a'),
    thumbnail: $li => $li.find('img'),
    rent: $li => $li.find('.nooklyn_listing_square_price'),
    noFee: $li => $li.find('.nooklyn_listing_square_fee').length
  },
  {
    url: `https://www.compass.com/search/rentals/nyc/prospect-heights/?bedrooms=${BEDS}&max_price=${MAX_RENT}`,
    liSelector: 'uc-listing-card',
    link: $li => $li.find('.uc-listingCard-titleWrapper'),
    thumbnail: $li => $li.find('.uc-listingCard-image'),
    rent: $li => $li.find('[data-tn="listingCard-label-price"]'),
    noFee: $li => $li.find('.uc-listingCard-cornerBox').text().match(/no fee/i)
  },
  {
    url: `http://streeteasy.com/for-rent/prospect-heights/price:-${MAX_RENT}%7Cbeds:${BEDS}`,
    liSelector: '#result-details .item:not(.featured)',
    link: $li => $li.find('a[href*="/building"]'),
    thumbnail: $li => $li.find('.photo img'),
    rent: $li => $li.find('.price'),
    noFee: $li => $li.find('.no_fee').length
  },
  {
    url: `http://www.myspace-nyc.com/?layout=${BEDS}br&max_price=${MAX_RENT}&neighborhoods=166&page=1&sort=updated&view=map`,
    liSelector: '.listing ',
    link: $li => $li.find('a'),
    thumbnail: $li => $li.find('img'),
    rent: $li => $li.find('.price'),
    noFee: $li => false
  },
  {
    url: `https://www.nakedapartments.com/renter/listings/search?bldid=&nids=28&aids=${BEDS * 2}&min_rent=&max_rent=${MAX_RENT}&amids=&pets=&baths=&oh=&subl=&button=`,
    liSelector: '.listing-row',
    link: $li => $li.find('.listing-row__image-link'),
    thumbnail: $li => $li.find('.listing-row__image-link img'),
    rent: $li => $li.find('.listing-row__rent'),
    noFee: $li => $li.find('.offer').text().match(/no fee/i)
  },
  {
    url: `https://www.zumper.com/apartments-for-rent/new-york-ny/prospect-heights/${BEDS}-beds/under-${MAX_RENT}?box=-73.97743,40.67170,-73.96261,40.68403`,
    liSelector: '.listingFeed [ng-repeat*=item]',
    link: $li => $li.find('[ng-href*="/apartments-for-rent"]'),
    thumbnail: $li => $li.find('.feedItem-imgBox img'),
    rent: $li => $li.find('[ng-bind="::item.priceText"]'),
    noFee: $li => $li.find('.feedItem-status').text().match(/no broker fee/i)
  },
  {
    url: `https://www.renthop.com/search/nyc?location_search=&bedrooms%5B%5D=${BEDS}&min_price=0&max_price=${MAX_RENT}&q=&neighborhoods_str=78&sort=hopscore&page=1&search=1`,
    liSelector: '.search-listing td',
    link: $li => $li.find('a[href*="listings"]'),
    thumbnail: $li => $li.find('.search-photo-first img'),
    rent: $li => $li.find('[id*="listing"]'),
    noFee: $li => $li.find('.listing-search-info').text().match(/no fee/i)
  },
  {
    url: `https://www.triplemint.com/listings?listing_type=rental&max_price=${MAX_RENT}&neighborhood=78&bedrooms=${BEDS}`,
    liSelector: '.listing-card',
    link: $li => `<a/>${$li.find('.thumbnail').css('background-image')}</a>`,
    thumbnail: $li => $li.find('.thumbnail'),
    rent: $li => $li.find('.price'),
    noFee: $li => false
  },
  {
    url: `https://newyork.craigslist.org/search/abo?query="prospect+heights"&max_price=${MAX_RENT}&min_bedrooms=${BEDS}&max_bedrooms=${BEDS}&availabilityMode=0`,
    liSelector: '.result-row',
    link: $li => $li.find('> a'),
    thumbnail: $li => $li.find('img'),
    rent: $li => $li.find('.result-price'),
    noFee: $li => true
  },
  {
    url: `https://www.nybits.com/search/?_a%21process=y&_rid_=5&_ust_todo_=65733&_xid_=lb..I_O3aR5Fr0-1501456916&%21%21atypes=${BEDS}br&%21%21rmin=&%21%21rmax=${MAX_RENT}&%21%21fee=nofee&%21%21orderby=dateposted&%21%21nsearch=prospect_heights&submit=+SHOW+RENTAL+APARTMENTS+`,
    liSelector: '#rentaltable tr',
    link: $li => $li.find('a'),
    thumbnail: $li => $li,
    rent: $li => $li.find('.lst_sr_price'),
    noFee: $li => true
  },
  {
    url: `https://www.trulia.com/for_rent/5210_nh/${BEDS}p_beds/0-${MAX_RENT}_price/beds;d_sort/`,
    liSelector: '.card',
    link: $li => $li.find('a'),
    thumbnail: $li => $li.find('.cardPhoto'),
    rent: $li => $li.find('.cardPrice'),
    noFee: $li => false
  }
]

const main = async () => {
  await scrape(scraperConfig)
  const latestListings = await db.listings.find({
    scrapedOn: {
      $gte: moment().subtract(3, 'minutes').toDate()
    }
  })
  const realListings = _.filter(
    latestListings,
    listing =>
      Math.abs(Number(MAX_RENT) - listing.rent) <= 1000 && listing.noFee
  )
  const listings = _.sortBy(realListings, listing => -listing.rent).reverse()
  if (listings.length) await mail(listings)
  process.exit()
}

main().catch(console.error)