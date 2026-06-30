<?php
/*
Plugin Name: Gengar Card Price Manager
Description: Registers a "Gengar Card" custom post type for managing card prices in WordPress, and exposes them via the REST API for the React front end to consume.
Version: 1.0
*/

/*
  PURPOSE OF THIS FILE:
  Instead of hardcoding prices in a React file, prices are managed as normal
  WordPress content (just like Posts or Pages) through wp-admin. Each "Gengar
  Card" post represents one priced card, identified by its Pokemon TCG API
  card ID, with a price attached via an ACF field.

  This file does two things:
  1. Registers the "Gengar Card" custom post type, with REST API support enabled
  2. Exposes the ACF fields (card_id, price) inside that REST API response,
     since ACF fields aren't included by default
*/

// STEP 1: Register the custom post type
add_action('init', function () {
    register_post_type('gengar_card', array(
        'labels' => array(
            'name' => 'Gengar Cards',
            'singular_name' => 'Gengar Card',
        ),
        'public' => true,
        'show_in_rest' => true,        // <- this is what exposes it at /wp-json/wp/v2/gengar_card
        'rest_base' => 'gengar_card',
        'supports' => array('title'),  // we only need the title field (used as a label in admin)
        'menu_icon' => 'dashicons-money-alt',
    ));
});

// STEP 2: Expose the ACF fields (card_id, variant, and price) in the REST
// API response. By default, WordPress's REST API does NOT include ACF
// field values — register_rest_field() manually adds them to the JSON response.
add_action('rest_api_init', function () {
    register_rest_field('gengar_card', 'card_id', array(
        'get_callback' => function ($post) {
            return get_field('card_id', $post['id']);
        },
    ));

    register_rest_field('gengar_card', 'variant', array(
        'get_callback' => function ($post) {
            return get_field('variant', $post['id']);
        },
    ));

    register_rest_field('gengar_card', 'price', array(
        'get_callback' => function ($post) {
            return get_field('price', $post['id']);
        },
    ));
});
