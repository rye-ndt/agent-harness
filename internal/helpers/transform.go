package helpers

func SliceToMap[T any, K comparable, V any](
	s []T,
	transformer func(item T) (key K, val V),
) map[K]V {
	result := map[K]V{}

	for _, item := range s {
		k, v := transformer(item)

		result[k] = v
	}

	return result
}
