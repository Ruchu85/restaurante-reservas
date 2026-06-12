"""Spain geographic data: provinces, communities and major cities."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Province:
    name: str
    community: str
    capital: str
    major_cities: list[str]


SPAIN_PROVINCES: list[Province] = [
    # Andalucía
    Province("Almería", "Andalucía", "Almería", ["Almería", "El Ejido", "Roquetas de Mar"]),
    Province("Cádiz", "Andalucía", "Cádiz", ["Jerez de la Frontera", "Algeciras", "Cádiz", "San Fernando"]),
    Province("Córdoba", "Andalucía", "Córdoba", ["Córdoba", "Lucena", "Montilla"]),
    Province("Granada", "Andalucía", "Granada", ["Granada", "Motril", "Armilla"]),
    Province("Huelva", "Andalucía", "Huelva", ["Huelva", "Lepe", "Moguer"]),
    Province("Jaén", "Andalucía", "Jaén", ["Jaén", "Linares", "Úbeda"]),
    Province("Málaga", "Andalucía", "Málaga", ["Málaga", "Marbella", "Fuengirola", "Vélez-Málaga", "Torremolinos"]),
    Province("Sevilla", "Andalucía", "Sevilla", ["Sevilla", "Dos Hermanas", "Alcalá de Guadaíra", "Utrera"]),
    # Aragón
    Province("Huesca", "Aragón", "Huesca", ["Huesca", "Monzón", "Barbastro"]),
    Province("Teruel", "Aragón", "Teruel", ["Teruel", "Alcañiz", "Andorra"]),
    Province("Zaragoza", "Aragón", "Zaragoza", ["Zaragoza", "Calatayud", "Utebo"]),
    # Asturias
    Province("Asturias", "Asturias", "Oviedo", ["Gijón", "Oviedo", "Avilés", "Siero"]),
    # Baleares
    Province("Baleares", "Islas Baleares", "Palma", ["Palma", "Calvià", "Ibiza", "Manacor"]),
    # Canarias
    Province("Las Palmas", "Canarias", "Las Palmas de Gran Canaria", ["Las Palmas de Gran Canaria", "Telde", "Santa Lucía de Tirajana"]),
    Province("Santa Cruz de Tenerife", "Canarias", "Santa Cruz de Tenerife", ["Santa Cruz de Tenerife", "San Cristóbal de La Laguna", "Arona"]),
    # Cantabria
    Province("Cantabria", "Cantabria", "Santander", ["Santander", "Torrelavega", "Camargo"]),
    # Castilla-La Mancha
    Province("Albacete", "Castilla-La Mancha", "Albacete", ["Albacete", "Hellín", "Almansa"]),
    Province("Ciudad Real", "Castilla-La Mancha", "Ciudad Real", ["Ciudad Real", "Puertollano", "Tomelloso"]),
    Province("Cuenca", "Castilla-La Mancha", "Cuenca", ["Cuenca", "Tarancón", "San Clemente"]),
    Province("Guadalajara", "Castilla-La Mancha", "Guadalajara", ["Guadalajara", "Azuqueca de Henares", "Cabanillas del Campo"]),
    Province("Toledo", "Castilla-La Mancha", "Toledo", ["Toledo", "Talavera de la Reina", "Illescas"]),
    # Castilla y León
    Province("Ávila", "Castilla y León", "Ávila", ["Ávila", "Arévalo"]),
    Province("Burgos", "Castilla y León", "Burgos", ["Burgos", "Miranda de Ebro", "Aranda de Duero"]),
    Province("León", "Castilla y León", "León", ["León", "Ponferrada", "San Andrés del Rabanedo"]),
    Province("Palencia", "Castilla y León", "Palencia", ["Palencia", "Guardo", "Aguilar de Campoo"]),
    Province("Salamanca", "Castilla y León", "Salamanca", ["Salamanca", "Béjar", "Ciudad Rodrigo"]),
    Province("Segovia", "Castilla y León", "Segovia", ["Segovia", "Cuéllar", "El Espinar"]),
    Province("Soria", "Castilla y León", "Soria", ["Soria", "Almazán"]),
    Province("Valladolid", "Castilla y León", "Valladolid", ["Valladolid", "Laguna de Duero", "Medina del Campo"]),
    Province("Zamora", "Castilla y León", "Zamora", ["Zamora", "Benavente", "Toro"]),
    # Cataluña
    Province("Barcelona", "Cataluña", "Barcelona", ["Barcelona", "Hospitalet de Llobregat", "Badalona", "Terrassa", "Sabadell", "Mataró"]),
    Province("Girona", "Cataluña", "Girona", ["Girona", "Figueres", "Blanes", "Salt"]),
    Province("Lleida", "Cataluña", "Lleida", ["Lleida", "Mollerussa", "Balaguer"]),
    Province("Tarragona", "Cataluña", "Tarragona", ["Tarragona", "Reus", "Tortosa", "Salou"]),
    # Extremadura
    Province("Badajoz", "Extremadura", "Badajoz", ["Badajoz", "Mérida", "Don Benito", "Almendralejo"]),
    Province("Cáceres", "Extremadura", "Cáceres", ["Cáceres", "Plasencia", "Navalmoral de la Mata"]),
    # Galicia
    Province("A Coruña", "Galicia", "A Coruña", ["A Coruña", "Vigo", "Santiago de Compostela", "Ferrol"]),
    Province("Lugo", "Galicia", "Lugo", ["Lugo", "Monforte de Lemos", "Viveiro"]),
    Province("Ourense", "Galicia", "Ourense", ["Ourense", "Verín", "O Barco de Valdeorras"]),
    Province("Pontevedra", "Galicia", "Pontevedra", ["Pontevedra", "Vigo", "Vilagarcía de Arousa"]),
    # La Rioja
    Province("La Rioja", "La Rioja", "Logroño", ["Logroño", "Calahorra", "Arnedo"]),
    # Madrid
    Province("Madrid", "Comunidad de Madrid", "Madrid", ["Madrid", "Móstoles", "Alcalá de Henares", "Fuenlabrada", "Leganés", "Getafe", "Alcorcón", "Torrejón de Ardoz"]),
    # Murcia
    Province("Murcia", "Región de Murcia", "Murcia", ["Murcia", "Cartagena", "Lorca", "Molina de Segura"]),
    # Navarra
    Province("Navarra", "Comunidad Foral de Navarra", "Pamplona", ["Pamplona", "Tudela", "Barañáin"]),
    # País Vasco
    Province("Álava", "País Vasco", "Vitoria-Gasteiz", ["Vitoria-Gasteiz", "Llodio", "Amurrio"]),
    Province("Guipúzcoa", "País Vasco", "San Sebastián", ["San Sebastián", "Irun", "Errenteria", "Eibar"]),
    Province("Vizcaya", "País Vasco", "Bilbao", ["Bilbao", "Getxo", "Barakaldo", "Santurtzi"]),
    # Comunidad Valenciana
    Province("Alicante", "Comunidad Valenciana", "Alicante", ["Alicante", "Elche", "Torrevieja", "Orihuela", "Benidorm"]),
    Province("Castellón", "Comunidad Valenciana", "Castellón de la Plana", ["Castellón de la Plana", "Vila-real", "Benicarló"]),
    Province("Valencia", "Comunidad Valenciana", "Valencia", ["Valencia", "Torrent", "Gandia", "Paterna", "Sagunto"]),
    # Ciudades autónomas
    Province("Ceuta", "Ceuta", "Ceuta", ["Ceuta"]),
    Province("Melilla", "Melilla", "Melilla", ["Melilla"]),
]

PROVINCE_MAP: dict[str, Province] = {p.name.lower(): p for p in SPAIN_PROVINCES}
COMMUNITY_MAP: dict[str, list[Province]] = {}
for p in SPAIN_PROVINCES:
    COMMUNITY_MAP.setdefault(p.community.lower(), []).append(p)


def get_province(name: str) -> Province | None:
    return PROVINCE_MAP.get(name.lower())


def get_provinces_by_community(community: str) -> list[Province]:
    return COMMUNITY_MAP.get(community.lower(), [])


def list_all_cities() -> list[tuple[str, str, str]]:
    """Returns (city, province, community) tuples for all major cities."""
    result = []
    for p in SPAIN_PROVINCES:
        for city in p.major_cities:
            result.append((city, p.name, p.community))
    return result


def resolve_location(location: str) -> list[tuple[str, str, str]]:
    """
    Given a location string (city, province or community), returns
    a list of (city, province, community) search targets.
    """
    loc_lower = location.lower().strip()

    # Try as community
    if loc_lower in COMMUNITY_MAP:
        targets = []
        for p in COMMUNITY_MAP[loc_lower]:
            for city in p.major_cities:
                targets.append((city, p.name, p.community))
        return targets

    # Try as province
    if loc_lower in PROVINCE_MAP:
        p = PROVINCE_MAP[loc_lower]
        return [(city, p.name, p.community) for city in p.major_cities]

    # Treat as city — find its province
    for p in SPAIN_PROVINCES:
        for city in p.major_cities:
            if city.lower() == loc_lower:
                return [(city, p.name, p.community)]

    # Fall back: treat as raw city name
    return [(location, "", "")]
